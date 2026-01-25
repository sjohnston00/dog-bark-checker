import React from 'react'
import { data, Link } from 'react-router'
import type { Route } from './+types/devices.index'
import db from '~/utils/db.server'
import DevicesRepository from '~/utils/DevicesRepository.server'
import { Heading } from '~/components/ui/heading'
import { EyeIcon, ViewIcon } from 'lucide-react'

export async function loader({ request }: Route.LoaderArgs) {
  const devicesRepo = new DevicesRepository({ db: db })
  const devices = devicesRepo.getAll()

  return data({
    devices
  })
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const { devices } = loaderData
  return (
    <div>
      <Heading>Devices</Heading>
      <div className='alert alert-soft mt-4'>
        <span>
          here you'll set up your cameras for <code>rtsp</code> protocol to
          record the camera AUDIO feed, this way when a bark is detected you can
          see which camera detected it. and when starting a recording you can
          select a camera.
        </span>
      </div>
      <div className='mt-4'>
        {devices.length === 0 ? (
          <div className='alert alert-info'>
            <span>No devices found. Please add a device.</span>
          </div>
        ) : (
          <table className='table w-full'>
            <thead>
              <tr>
                <th>Name</th>
                <th>RTSP URL</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device: any) => (
                <tr key={device.id}>
                  <td>{device.name}</td>
                  <td>{device.rtspUrl}</td>
                  <th>
                    <Link to={`/devices/${device.id}`} className='btn'>
                      <EyeIcon />
                    </Link>
                  </th>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
