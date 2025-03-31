import { toast } from "sonner";

const { useState } = require("react")

const useFetch =(cb)=>{
    const [data, setData] = useState();
    const [loading, setLoading] = useState();
    const [error, setError] = useState();

         const fn = async(... args)=>{
            setLoading(true);
            setError(null);
            

            try{
                const response = await cb (...args);
                setData(response);
                setError(null);
                return response; 

            }catch(error){
                setError(error);
                toast.error(error.message)
                throw error;
            }finally{
                setLoading(false);
            }
         }

         return {data, loading, error, fn , setData};

};

export default useFetch;