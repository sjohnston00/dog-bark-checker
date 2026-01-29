import { Link } from 'react-router'

export function Navbar() {
  return (
    <nav className='flex items-center gap-8 py-4'>
      <div className='flex items-center gap-4'>
        <Link to='/' className='text-lg font-bold tracking-tight'>
          Dog Bark
        </Link>
      </div>

      <div className='flex items-center gap-4 text-sm'>
        <Link to='/' className='hover:underline'>
          Recordings
        </Link>
        <Link to='/devices' className='hover:underline'>
          Devices
        </Link>
      </div>
    </nav>
  )
}

export default Navbar
