"use client"

import { createTransaction, updateTransaction } from '@/actions/transactions'
import { transactionSchema } from '@/app/lib/schema'
import CreateAccountDrawer from '@/components/create-account-drawer'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import useFetch from '@/hooks/use-fetch'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {ReceiptScanner} from './receipt-scanner'

const AddTransactionForm = ({ accounts,
   categories,
    editMode=false,
    initialData = null }) => {

  const router = useRouter()

  const searchParams =useSearchParams();
  const editId = searchParams.get("edit");

  console.log("aapka paisa seth ", initialData);
  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors },
    watch,
    getValues,
    reset,
  } = useForm({
    resolver: zodResolver(transactionSchema),
    defaultValues:
    editMode && initialData ? 
    
    {
      type: initialData.type,
      amount: initialData.amount.toString(),
      description: initialData.description,
      accountId: initialData.accountId,
      category: initialData.category,
      date: new Date(initialData.date),
      isRecurring: initialData.isRecurring,
      ...(initialData.recurringInterval && {
        recurringInterval: initialData.recurringInterval,
      }),
      
    }:
     {
      type: "EXPENSE",
      amount: "",
      description: "",
      accountId: accounts.find((ac) => ac.isDefault)?.id || "",
      category: categories.find(c => c.type === "EXPENSE")?.id || "",
      date: new Date(),
      isRecurring: false,
      recurringInterval: "MONTHLY",
    },
  })

  
  const {
    loading: transactionLoading,
    fn: transactionFn,
    data: transactionResult,
    error: transactionError,
  } = useFetch(editMode ? updateTransaction :createTransaction)

  const type = watch("type")
  const isRecurring = watch("isRecurring")
  const date = watch("date")

  const filteredCategories = categories.filter(
    (category) => category.type === type
  )

  useEffect(() => {
    const firstCategory = categories.find((cat) => cat.type === type);
    if (firstCategory) {
      setValue("categoryId", firstCategory.id);
    }
  }, [type, categories, setValue]);
  

  


  const onSubmit = async (data) => {
    console.log("✅ ON SUBMIT CALLED")
    const formData = {
      ...data,
      amount: parseFloat(data.amount),
    }
    console.log("📦 Submitting data: ", formData)


    if(editMode){
      await transactionFn(editId, formData)
    }else{
      await transactionFn(formData)
    }
     
  }

  const onError = (errors) => {
    console.log("❌ Form validation errors:", errors)
  }

  useEffect(() => {
    if (transactionResult?.success && !transactionLoading) {
      toast.success( editMode ? "Transaction  updated successfully": "Transaction created  Successfully")
      reset()
      router.push(`/account/${transactionResult.data.accountId}`)
    }

    if (transactionError) {
      toast.error(transactionError.message || "Failed to create transaction")
    }
  }, [transactionResult, transactionLoading, transactionError, reset, router, editMode])


  const handleScanComplete=(scannedData)=>{
    if(scannedData) {
      setValue("amount", scannedData.amount.toString());
      setValue("date", new Date (scannedData.date));
      if(scannedData.description){
        setValue("description", scannedData.description);
      }
      if(scannedData.category){
        setValue("category", scannedData.category)
      }
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit, onError)}>
      {/* Ai receipt Scanner */}

       { !editMode && <ReceiptScanner onScanComplete={handleScanComplete}></ReceiptScanner>}

      {/* Type */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Type</label>
        <Select
          onValueChange={(value) => setValue("type", value)}
          defaultValue={type}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EXPENSE">Expense</SelectItem>
            <SelectItem value="INCOME">Income</SelectItem>
          </SelectContent>
        </Select>
        {errors.type && (
          <p className="text-sm text-red-500">{errors.type.message}</p>
        )}
      </div>

      {/* Amount & Account */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Amount</label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            className="w-full"
            {...register("amount")}
          />
          {errors.amount && (
            <p className="text-sm text-red-500">{errors.amount.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Account</label>
          <Select
            onValueChange={(value) => setValue("accountId", value)}
            defaultValue={getValues("accountId")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name} (₹{parseFloat(account.balance).toFixed(2)})
                </SelectItem>
              ))}
              <CreateAccountDrawer>
                <Button variant="ghost" className="w-full text-left">
                  Create Account
                </Button>
              </CreateAccountDrawer>
            </SelectContent>
          </Select>
          {errors.accountId && (
            <p className="text-sm text-red-500">{errors.accountId.message}</p>
          )}
        </div>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Category</label>
        <Select
          onValueChange={(value) => setValue("category", value)}
          defaultValue={getValues("category")}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {filteredCategories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.category && (
          <p className="text-sm text-red-500">{errors.category.message}</p>
        )}
      </div>

      {/* Date */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Date</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full pl-3 text-left font-normal">
              {date ? format(date, "PPP") : <span>Pick a date</span>}
              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(date) => setValue("date", date)}
              disabled={(date) =>
                date > new Date() || date < new Date("1900-01-01")
              }
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {errors.date && (
          <p className="text-sm text-red-500">{errors.date.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <Input
          placeholder="Enter description"
          className="w-full"
          {...register("description")}
        />
        {errors.description && (
          <p className="text-sm text-red-500">{errors.description.message}</p>
        )}
      </div>

      {/* Recurring Switch */}
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <label className="text-sm font-medium">Recurring Transaction</label>
          <p className="text-sm text-muted-foreground">
            Set up a recurring schedule for this transaction
          </p>
        </div>
        <Switch
          checked={isRecurring}
          onCheckedChange={(checked) => setValue("isRecurring", checked)}
        />
      </div>

      {/* Recurring Interval */}
      {isRecurring && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Recurring Interval</label>
          <Select
            onValueChange={(value) => setValue("recurringInterval", value)}
            defaultValue={getValues("recurringInterval") || "MONTHLY"}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Interval" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DAILY">Daily</SelectItem>
              <SelectItem value="WEEKLY">Weekly</SelectItem>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
              <SelectItem value="YEARLY">Yearly</SelectItem>
            </SelectContent>
          </Select>
          {errors.recurringInterval && (
            <p className="text-sm text-red-500">{errors.recurringInterval.message}</p>
          )}
        </div>
      )}

      {/* Submit Buttons */}
      <div className="flex gap-4 w-full">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={transactionLoading}
        >
          {transactionLoading ? 
          <>
          <Loader2 className ="mr-2 h-4 w-4 animate-spin"></Loader2>
          {editMode ? "Updating....": "Creating...."}
          </> : editMode ? ( "Update Transaction") : ("Add Transaction") }
        </Button>
      </div>
    </form>
  )
}

export default AddTransactionForm
