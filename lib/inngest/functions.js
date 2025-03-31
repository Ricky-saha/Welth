import { sendEmail } from "@/actions/send-email";
import { db } from "../prisma";
import { inngest } from "./client";
import EmailTemplate from "@/emails/template";
import { render } from '@react-email/render'; // Make sure this is imported
import { GoogleGenerativeAI } from "@google/generative-ai";


export const checkBudgetAlerts = inngest.createFunction(
  { name: "Check Budget Alerts" },
  { cron: "0 */6 * * *" }, // Every 6 hours
  async ({ step }) => {
    try {
      // Add top-level try/catch
      const budgets = await step.run("fetch-budgets", async () => {
        try {
          // Log the start of the operation
          console.log("Fetching budgets");
          
          const result = await db.budget.findMany({
            include: {
              user: {
                include: {
                  accounts: {
                    where: {
                      isDefault: true,
                    },
                  },
                },
              },
            },
          });
          
          console.log(`Found ${result.length} budgets`);
          return result;
        } catch (error) {
          console.error("Error fetching budgets:", error);
          throw error; // Rethrow to be handled by Inngest
        }
      });

      const results = [];

      for (const budget of budgets) {
        const defaultAccount = budget.user.accounts[0];
        if (!defaultAccount) {
          console.log(`Skipping budget ${budget.id} - no default account`);
          continue; // Skip if no default account
        }

        try {
          await step.run(`check-budget-${budget.id}`, async () => {
            try {
              console.log(`Processing budget ${budget.id} for user ${budget.userId}`);
              
              const startDate = new Date();
              startDate.setDate(1); // Start of current month

              // Calculate total expenses for the default account only
              const expenses = await db.transaction.aggregate({
                where: {
                  userId: budget.userId,
                  accountId: defaultAccount.id, // Only consider default account
                  type: "EXPENSE",
                  date: {
                    gte: startDate,
                  },
                },
                _sum: {
                  amount: true,
                },
              });

              // Convert to number safely
              const totalExpenses = expenses._sum.amount?.toNumber() || 0;
              const budgetAmount = Number(budget.amount);
              const percentageUsed = (totalExpenses / budgetAmount) * 100;

              console.log(`Budget ${budget.id}: ${percentageUsed.toFixed(1)}% used (${totalExpenses}/${budgetAmount})`);

              // Check if we should send an alert
              if (
                percentageUsed >= 80 && // Default threshold of 80%
                (!budget.lastAlertSent ||
                  isNewMonth(new Date(budget.lastAlertSent), new Date()))
              ) {
                console.log(`Sending alert for budget ${budget.id}`);
                
                // // Create proper email data structure matching the template
                // const emailData = {
                //   stats: {
                //     totalExpenses: totalExpenses
                //   },
                //   percentageUsed: percentageUsed,
                //   budgetAmount: budgetAmount,
                //   totalExpenses: totalExpenses,
                //   accountName: defaultAccount.name
                // };

                // Render the React component to HTML
                // const emailHtml = render(
                //   EmailTemplate({
                //     userName: budget.user.name || "User",
                //     type: "budget-alert",
                //     data: emailData
                //   })
                // );

                // Send email with HTML instead of React component

                const emailResult = await sendEmail({
                    to: budget.user.email,
                    subject: `Budget Alert for ${defaultAccount.name}`,
                    react: EmailTemplate({
                      userName: budget.user.name,
                      type: "budget-alert",
                      data: {
                        percentageUsed,
                        budgetAmount: parseInt(budgetAmount).toFixed(1),
                        totalExpenses: parseInt(totalExpenses).toFixed(1),
                        accountName: defaultAccount.name,
                      },
                    }),
                  });

                console.log(`Email result:`, emailResult);

                if (emailResult.success) {
                  // Update last alert sent
                 const updateResult =  await db.budget.update({
                    where: { id: budget.id },
                    data: { lastAlertSent: new Date() },
                  });
                  
                  results.push({
                    budgetId: budget.id,
                    status: "alert_sent",
                    email: budget.user.email
                  });
                  console.log("Database update result:", updateResult);
                } else {
                  results.push({
                    budgetId: budget.id,
                    status: "email_failed",
                    error: emailResult.error
                  });
                }
              } else {
                console.log(`No alert needed for budget ${budget.id}`);
                results.push({
                  budgetId: budget.id,
                  status: "no_alert_needed",
                  percentageUsed
                });
              }
            } catch (error) {
              console.error(`Error processing budget ${budget.id}:`, error);
              results.push({
                budgetId: budget.id,
                status: "error",
                error: error.message
              });
            }
          });
        } catch (error) {
          console.error(`Step error for budget ${budget.id}:`, error);
          results.push({
            budgetId: budget.id,
            status: "step_error",
            error: error.message
          });
        }
      }

      return {
        processed: budgets.length,
        results
      };
    } catch (error) {
      console.error("Top-level error in budget check function:", error);
      return {
        error: error.message,
        processed: 0
      };
    }
  }
);

function isNewMonth(lastAlertDate, currentDate) {
  return (
    lastAlertDate.getMonth() !== currentDate.getMonth() ||
    lastAlertDate.getFullYear() !== currentDate.getFullYear()
  );
}

export const triggerRecurringTransactions = inngest.createFunction(
  {
    id: "trigger-recurring-transactions", // Unique ID,
    name: "Trigger Recurring Transactions",
  },
  { cron: "0 0 * * *" }, // Daily at midnight
  async ({ step }) => {
    const recurringTransactions = await step.run(
      "fetch-recurring-transactions",
      async () => {
        return await db.transaction.findMany({
          where: {
            isRecurring: true,
            status: "COMPLETED",
            OR: [
              { lastProcessed: null },
              {
                nextRecurringDate: {
                  lte: new Date(),
                },
              },
            ],
          },
        });
      }
    );

    // Send event for each recurring transaction in batches
    if (recurringTransactions.length > 0) {
      const events = recurringTransactions.map((transaction) => ({
        name: "transaction.recurring.process",
        data: {
          transactionId: transaction.id,
          userId: transaction.userId,
        },
      }));

      // Send events directly using inngest.send()
      await inngest.send(events);
    }

    return { triggered: recurringTransactions.length };
  }
);


export const processRecurringTransaction = inngest.createFunction(
  {
    id: "process-recurring-transaction",
    name: "Process Recurring Transaction",
    throttle: {
      limit: 10, // Process 10 transactions
      period: "1m", // per minute
      key: "event.data.userId", // Throttle per user
    },
  },
  { event: "transaction.recurring.process" },
  async ({ event, step }) => {
    // Validate event data
    if (!event?.data?.transactionId || !event?.data?.userId) {
      console.error("Invalid event data:", event);
      return { error: "Missing required event data" };
    }

    await step.run("process-transaction", async () => {
      const transaction = await db.transaction.findUnique({
        where: {
          id: event.data.transactionId,
          userId: event.data.userId,
        },
        include: {
          account: true,
        },
      });

      if (!transaction || !isTransactionDue(transaction)) return;

      // Create new transaction and update account balance in a transaction
      await db.$transaction(async (tx) => {
        // Create new transaction
        await tx.transaction.create({
          data: {
            type: transaction.type,
            amount: transaction.amount,
            description: `${transaction.description} (Recurring)`,
            date: new Date(),
            category: transaction.category,
            userId: transaction.userId,
            accountId: transaction.accountId,
            isRecurring: false,
          },
        });

        // Update account balance
        const balanceChange =
          transaction.type === "EXPENSE"
            ? -transaction.amount.toNumber()
            : transaction.amount.toNumber();

        await tx.account.update({
          where: { id: transaction.accountId },
          data: { balance: { increment: balanceChange } },
        });

        // Update last processed date and next recurring date
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            lastProcessed: new Date(),
            nextRecurringDate: calculateNextRecurringDate(
              new Date(),
              transaction.recurringInterval
            ),
          },
        });
      });
    });
  }
);


function isTransactionDue(transaction){
  if(! transaction.lastProcessed) return true;

  const today = new Date();
  const nextDue =  new Date(transaction.nextRecurringDate) 

  //compare with nextDue date 

  return nextDue <= today;


}


function calculateNextRecurringDate(startDate, interval) {
  const date = new Date(startDate);
  switch (interval) {
    case "DAILY":
      date.setDate(date.getDate() + 1);
      break;
    case "WEEKLY":
      date.setDate(date.getDate() + 7);
      break;
    case "MONTHLY":
      date.setMonth(date.getMonth() + 1); // Fixed: was using setDate instead of setMonth
      break;
    case "YEARLY":
      date.setFullYear(date.getFullYear() + 1); // Fixed: was using setDate instead of setFullYear
      break;
  }
  return date;
}



export const generateMonthlyReports = inngest.createFunction(
  {
    id: "generate-monthly-reports",
    name: "Generate Monthly Reports",
  },
  { cron: "0 0 1 * *" }, // First day of each month
  async ({ step }) => {
    const users = await step.run("fetch-users", async () => {
      return await db.user.findMany({
        include: { accounts: true },
      });
    });

    for (const user of users) {
      await step.run(`generate-report-${user.id}`, async () => {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);

        const stats = await getMonthlyStats(user.id, lastMonth);
        const monthName = lastMonth.toLocaleString("default", {
          month: "long",
        });

        // Generate AI insights
        const insights = await generateFinancialInsights(stats, monthName);

        await sendEmail({
          to: user.email,
          subject: `Your Monthly Financial Report - ${monthName}`,
          react: EmailTemplate({
            userName: user.name,
            type: "monthly-report",
            data: {
              stats,
              month: monthName,
              insights,
            },
          }),
        });
      });
    }

    return { processed: users.length };
  }
);

async function generateFinancialInsights(stats, month) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Analyze this financial data and provide 3 concise, actionable insights.
    Focus on spending patterns and practical advice.
    Keep it friendly and conversational.

    Financial Data for ${month}:
    - Total Income: ₹${stats.totalIncome}
    - Total Expenses: ₹${stats.totalExpenses}
    - Net Income: ₹${stats.totalIncome - stats.totalExpenses}
    - Expense Categories: ${Object.entries(stats.byCategory)
      .map(([category, amount]) => `${category}: ₹${amount}`)
      .join(", ")}

    Format the response as a JSON array of strings, like this:
    ["insight 1", "insight 2", "insight 3"]
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Error generating insights:", error);
    return [
      "Your highest expense category this month might need attention.",
      "Consider setting up a budget for better financial management.",
      "Track your recurring expenses to identify potential savings.",
    ];
  }
}

async function getMonthlyStats(userId, month) {
  const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
  const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  const transactions = await db.transaction.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  return transactions.reduce(
    (stats, t) => {
      const amount = t.amount.toNumber();
      if (t.type === "EXPENSE") {
        stats.totalExpenses += amount;
        stats.byCategory[t.category] =
          (stats.byCategory[t.category] || 0) + amount;
      } else {
        stats.totalIncome += amount;
      }
      return stats;
    },
    {
      totalExpenses: 0,
      totalIncome: 0,
      byCategory: {},
      transactionCount: transactions.length,
    }
  );
}

