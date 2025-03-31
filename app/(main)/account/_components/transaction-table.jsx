"use client"
import { bulkDeleteTransactions } from '@/actions/accounts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { categoryColors } from '@/data/categories'
import useFetch from '@/hooks/use-fetch'
import { format } from 'date-fns'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, MoreHorizontal, RefreshCw, Search, Trash, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'
import { BarLoader } from 'react-spinners'
import { toast } from 'sonner'

const RECURRING_INTERVALS ={
    DAILY:"Daily",
    WEEKLY:"Weekly",
    MONTHLY:"Monthly",
    YEARLY:"Yearly",
}

// Add pagination settings
const ITEMS_PER_PAGE = 10;

const TransactionTable = ({transactions}) => {

   const router =  useRouter();

    const [selectedIds, setSelectedIds] = useState([]);

    const [sortConfig, setSortConfig] = useState({
        field:"date",
        direction:"desc"
    })

    const [searchTerm, setSearchTerm] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [recurringFilter, setRecurringFilter] = useState("");
    
    // Add pagination state
    const [currentPage, setCurrentPage] = useState(1);


   const {
    loading: deleteLoading,
    fn: deleteFn,
    data:deleted,
   } = useFetch(bulkDeleteTransactions)

 

   const filteredAndSortedTransactions =  useMemo(()=>{
    let result = [...transactions];

    if(searchTerm){
        const searchLower = searchTerm.toLowerCase();
        result =result.filter((transaction)=>
        transaction.description?.toLowerCase().includes(searchLower))
    }

    //Apply recurring filter
    if(recurringFilter){
        result = result.filter((transaction)=>{
            if(recurringFilter === "recurring") return transaction.isRecurring;
            return !transaction.isRecurring;
        })
    }

    // Apply type Filter
    if(typeFilter){
        result = result.filter((transaction) => transaction.type === typeFilter);
    }

    // Apply sorting
    result.sort((a,b)=>{
        let comparison = 0

        switch(sortConfig.field){
            case "date":
                comparison = new Date(a.date) - new Date(b.date);
                break;
            case "amount":
                comparison = a.amount - b.amount;
                break;
            case "category":
                comparison = a.category.localeCompare(b.category);
                break;
            default :
            comparison = 0;
        }
        return sortConfig.direction ==="asc" ? comparison: -comparison;
    })
    return result;
   },[
    transactions,
    searchTerm,
    typeFilter,
    recurringFilter,
    sortConfig,
   ]);

    // Calculate pagination values
    const totalItems = filteredAndSortedTransactions.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    
    // Get current page items
    const paginatedTransactions = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredAndSortedTransactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredAndSortedTransactions, currentPage]);

    // Handle page changes
    const handlePageChange = (page) => {
        setCurrentPage(page);
    };

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, typeFilter, recurringFilter, sortConfig]);

    console.log(selectedIds);
   // console.log(filteredAndSortedTransactions);

    const handleSort =(field)=>{
        setSortConfig(current=>({
            field,
            direction:
            current.field == field && current.direction ==="asc"?"desc" : "asc"
        }))
    };

    const handleSelect=(id)=> {
        setSelectedIds(current=> current.includes(id)
        ? current.filter(item=>item!=id)
        : [...current, id])
    }



    const handleSelectAll=()=>{
        setSelectedIds((current)=>
            current.length === paginatedTransactions.length
        ? []
        : paginatedTransactions.map((t)=>t.id))
    }


    const handleBulkDelete= async()=>{
        if (!window.confirm(
            `Are you sure you want to delete ${selectedIds.length} transactions?`
        )){
            return;
        }
        deleteFn(selectedIds);
       };

       useEffect(()=>{
        if(deleted && ! deleteLoading){
            toast.error("Transactions deleted successfully");

        }
       })




    const handleClearFilters=()=>{
        setSearchTerm("");
        setTypeFilter("");
        setRecurringFilter("");
        setSelectedIds([]);
    };

  return (
    <div className="space-y-4 ">
           {deleteLoading &&( <BarLoader className=" mt-4" width={"100%"} color="#9333ea"/>)}


        {/* Filters */}
            
            <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"/>
                <Input
                placeholder="Search Transactions..."
                value={searchTerm}
                onChange={(e)=> setSearchTerm(e.target.value)}
                className="pl-8"
                 />
            </div>

                <div className="flex gap-2">
                <Select value ={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                        <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="INCOME">Income</SelectItem>
                        <SelectItem value="EXPENSE">Expense</SelectItem>
                    </SelectContent>
                </Select>

                <Select value ={recurringFilter} onValueChange={(value) => setRecurringFilter(value)}>
                    <SelectTrigger className="w-[155px]">
                        <SelectValue placeholder="All Transactions"/>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="recurring">Recurring Only</SelectItem>
                        <SelectItem value="non-recurring">Non-recurring Only</SelectItem>
                    </SelectContent>
                </Select>

                {selectedIds.length > 0 && (<div>
                    <Button variant ="destructive" size="sm" onClick={handleBulkDelete}>
                       <Trash className="h-4 w-4 mr-2"/> Delete Selected ({selectedIds.length})

                    </Button>
                </div>)
                }


                {(searchTerm || typeFilter || recurringFilter)&& 
                (<Button variant="outline" size="icon" onClick={handleClearFilters} title ="Clear Filters"><X className="h-4 w-4"/></Button>

                )}
                </div>
            </div>

        {/* transactions */}
        <div className="rounded-md border">
        <Table>
            <TableHeader>
                <TableRow>

                <TableHead className="w-[50px]">
                    <Checkbox onCheckedChange={handleSelectAll}
                    checked={
                        selectedIds.length ===
                        paginatedTransactions.length &&
                        paginatedTransactions.length > 0
                    }></Checkbox>
                </TableHead>

                <TableHead className="cursor-pointer"
                onClick={()=>handleSort("date")}>
                    <div className="flex items-center">Date{sortConfig.field ==="date"&&(
                        sortConfig.direction ==="asc"?( <ChevronUp className="ml-1 h-4 w-4"/>): (<ChevronDown className="ml-1 h-4 w-4">
                        </ChevronDown>)
                    )}</div>
                </TableHead>

               <TableHead>Description</TableHead>

               <TableHead className="cursor-pointer"
                onClick={()=>handleSort("category")}>
                <div className="flex items-center">Category{sortConfig.field ==="category"&&(
                    sortConfig.direction ==="asc"?( <ChevronUp className="ml-1 h-4 w-4"/>): (<ChevronDown className="ml-1 h-4 w-4">
                    </ChevronDown>)
                )}</div>
                </TableHead>

                <TableHead className="cursor-pointer"
                onClick={()=>handleSort("amount")}>
                <div className="flex items-center justify-end">Amount{sortConfig.field ==="amount"&&(
                    sortConfig.direction ==="asc"?( <ChevronUp className="ml-1 h-4 w-4"/>): (<ChevronDown className="ml-1 h-4 w-4">
                    </ChevronDown>)
                )}</div>
                </TableHead>

                <TableHead>
                    Recurring
                </TableHead>

                <TableHead className="w-[50px]"></TableHead>

                </TableRow>
            </TableHeader>
            <TableBody>
                {paginatedTransactions.length === 0 ?(
                    <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                            No Transaction Found
                        </TableCell>
                    </TableRow>
                ): (
                    paginatedTransactions.map((transaction)=> (
                
                <TableRow key={transaction.id}>
                <TableCell>
                    <Checkbox onCheckedChange={()=> handleSelect(transaction.id)}
                        checked={selectedIds.includes(transaction.id)}/>
                </TableCell>
                <TableCell>{format(new Date(transaction.date), "PP")}</TableCell>
                <TableCell>{transaction.description}</TableCell>
                <TableCell className="capitalize">
                    <span style={{
                        background:categoryColors[transaction.category],
                    }} className="px-2 py-1 rounded text-white text-sm">{transaction.category}</span></TableCell>
                <TableCell className="text-right font-medium" style={{
                    color: transaction.type ==="EXPENSE" ? "red" : "green",
                }}>
                    {transaction.type === "EXPENSE" ? "-" :"+"}₹{transaction.amount.toFixed(2)}</TableCell>
                    <TableCell>{transaction.isRecurring?(
                        <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger><Badge variant ="outline" className="gap-1 bg-purple-100 text-purple-700 hover:bg-purple-200">
                          <RefreshCw className="h-3 w-3"></RefreshCw>{RECURRING_INTERVALS[transaction.recurringInterval]}</Badge></TooltipTrigger>
                          <TooltipContent>
                            <div className="text-sm">
                                <div className="font-medium">Next Date:</div>
                                <div>{format(new Date(transaction.nextRecurringDate),"PP")}</div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                    ): (<Badge variant ="outline" className="gap-1">
                        <Clock className="h-3 w-3"></Clock>one-time</Badge>)}
                        </TableCell>

                        <TableCell>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant ="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4"></MoreHorizontal></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem
                                onClick={()=> router.push(
                                    `/transaction/create?edit=${transaction.id}`
                                )}>Edit</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" 
                                onClick={()=>deleteFn([transaction.id])}
                                >Delete</DropdownMenuItem>
                               
                            </DropdownMenuContent>
                        </DropdownMenu>

                        </TableCell>


                </TableRow>
                ))
                )}
            </TableBody>
        </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between py-2">
            <div className="text-sm text-muted-foreground">
              Showing <span className="font-medium">{Math.min(ITEMS_PER_PAGE * (currentPage - 1) + 1, totalItems)}</span> to{" "}
              <span className="font-medium">{Math.min(ITEMS_PER_PAGE * currentPage, totalItems)}</span> of{" "}
              <span className="font-medium">{totalItems}</span> transactions
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Previous Page</span>
              </Button>
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  // Show first 3 pages, current page, and last page
                  let pageNum;
                  if (totalPages <= 5) {
                    // If total pages is 5 or less, show all pages
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    // If current page is among first 3, show first 5 pages
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    // If current page is among last 3, show last 5 pages
                    pageNum = totalPages - 4 + i;
                  } else {
                    // Otherwise show 2 before and 2 after current page
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">Next Page</span>
              </Button>
            </div>
          </div>
        )}
    </div>
  )
}

export default TransactionTable