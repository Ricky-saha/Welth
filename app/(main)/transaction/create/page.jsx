import { getUserAccount } from '@/actions/dashboard'
import { defaultCategories } from '@/data/categories';
import React from 'react'
import AddTransactionForm from '../_components/transaction-form';
import { getTransaction } from '@/actions/transactions';

const AddTransaction = async ({searchParams}) => {

  const accounts = await getUserAccount();


  const editId = searchParams?.edit

  let initialData =null;
  if(editId){
    const transaction = await getTransaction(editId);
    initialData = transaction;
    console.log("your data", initialData);
  }

  return (
    <div className="max-w-3xl mx-auto px-5">
      <h1 className="text-5xl gradient-title mb-8">{editId ? "Update Transaction" : "Add Transaction"} </h1>

      <AddTransactionForm
      accounts={accounts}
      categories={defaultCategories}
      editMode={!!editId}
      initialData={initialData}
      />
    </div>
  )
}

export default AddTransaction