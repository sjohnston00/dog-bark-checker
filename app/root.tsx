import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration
} from 'react-router'

import { MenuIcon } from 'lucide-react'
import type { Route } from './+types/root'
import './app.css'

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' data-theme='dim'>
      <head>
        <meta charSet='utf-8' />
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <title>Dog Bark Detections</title>
        <meta
          name='description'
          content='View your dogs barks accross time periods'
        />
        <Meta />
        <Links />
      </head>
      <body>
        <div className='bg-base-100 drawer max-w-[100rem] mx-auto px-1 lg:drawer-open'>
          <input id='drawer' type='checkbox' className='drawer-toggle' />
          <div className='drawer-content'>
            <div className='bg-base-100 navbar w-full sticky top-0 gap-2 shadow-xs z-40'>
              <span
                className='tooltip tooltip-bottom before:text-xs before:content-[attr(data-tip)]'
                data-tip='Menu'>
                <label
                  aria-label='Open menu'
                  htmlFor='drawer'
                  className='btn btn-square btn-ghost drawer-button lg:hidden '>
                  <MenuIcon className='size-5' />
                </label>
              </span>
              <Link
                to='/'
                className='lg:hidden text-xl font-bold tracking-tight'>
                Dog Bark
              </Link>
            </div>
            <main className='ps-2'>{children}</main>
          </div>
          <div className='drawer-side z-40'>
            <label
              htmlFor='drawer'
              className='drawer-overlay'
              aria-label='Close menu'></label>
            <aside className='bg-base-100 min-h-screen w-80'>
              <div className='bg-base-100 navbar sticky top-0 gap-2 shadow-xs'>
                <Link to='/' className='text-xl font-bold tracking-tight'>
                  Dog Bark
                </Link>
              </div>

              <ul className='menu w-full'>
                <li>
                  <NavLink
                    to='/'
                    className={({ isActive }) =>
                      `${isActive ? 'menu-active' : ''}`
                    }>
                    Dashboard
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to='/recordings'
                    className={({ isActive }) =>
                      `${isActive ? 'menu-active' : ''}`
                    }>
                    Recordings
                  </NavLink>
                </li>
                <li>
                  <details>
                    <summary>Devices</summary>
                    <ul>
                      <li>
                        <NavLink
                          to='/devices'
                          end
                          className={({ isActive }) =>
                            `${isActive ? 'menu-active' : ''}`
                          }>
                          All
                        </NavLink>
                      </li>
                      <li>
                        <NavLink
                          to='/devices/new'
                          className={({ isActive }) =>
                            `${isActive ? 'menu-active' : ''}`
                          }>
                          New
                        </NavLink>
                      </li>
                    </ul>
                  </details>
                </li>
              </ul>
            </aside>
          </div>
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Oops!'
  let details = 'An unexpected error occurred.'
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error'
    details =
      error.status === 404
        ? 'The requested page could not be found.'
        : error.statusText || details
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message
    stack = error.stack
  }

  return (
    <main className='pt-16 p-4 container mx-auto'>
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className='w-full p-4 overflow-x-auto'>
          <code>{stack}</code>
        </pre>
      )}
    </main>
  )
}
