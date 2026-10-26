import Link from "next/link";

export default function Navbar() {
    return(
        <div className="bg-white flex items-center justify-between w-full pr-[10]">
            <div>
                <Link href="/">
                    <img className='w-auto max-w-[65px] ' src="/favicon.png" alt="messenger-ai-icon" />
                </Link>
            </div>
            
            <div className='flex items-center text-black gap-5'>
                <Link href='/register' className='bg-black text-white px-5 py-2 rounded-[10px]'>Register</Link>
                <Link href='/login' className='bg-blue-500 text-white px-5 py-2 rounded-[10px]'>Login</Link>
            </div>
        </div>
    );
}