import React from 'react'
import { Heading } from '~/components/ui/heading'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import type { Route } from './+types/recordings.index'
import db from '~/utils/db.server'
import DevicesRepository from '~/utils/DevicesRepository.server'
import { data, Form } from 'react-router'
import { Label } from '~/components/ui/label'

export async function loader({}: Route.LoaderArgs) {
  const devicesRepo = new DevicesRepository({ db: db })
  const devices = devicesRepo.getAll()

  return data({
    devices
  })
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const deviceId = formData.get('deviceId')

  // Here you would normally start the recording process for the selected device.
  console.log(`Starting recording on device ID: ${deviceId}`)

  return null
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const { devices } = loaderData
  return (
    <div>
      <Heading>Recordings</Heading>
      <div className='alert alert-soft mt-4'>
        <span>
          here you'll be able to start and view recordings from your cameras.
        </span>
      </div>
      <div className='alert alert-soft alert-info mt-4'>
        <span>
          TODO: display recording list with options to view, download, and
          delete recordings.
        </span>
      </div>
      <div className='alert alert-soft alert-info mt-4'>
        <span>
          TODO: display existing recording as pending and show the status of the
          recording. with the option to complete or cancel the recording.
        </span>
      </div>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant='primary'>Start recording</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start recording</DialogTitle>
          </DialogHeader>
          <p>Would you like to start recording a session on a device?</p>
          <Form method='post' id='start-recording-form'>
            <Label>Device</Label>
            <select
              name='deviceId'
              className='select w-full mt-2 mb-4'
              required>
              {devices.map((device: any) => (
                <option key={device.id} value={device.id}>
                  {device.name}
                </option>
              ))}
            </select>
          </Form>

          <DialogFooter>
            <DialogClose asChild>
              <Button type='button' btnStyle={'ghost'}>
                Close
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button
                type='submit'
                form='start-recording-form'
                variant={'primary'}>
                Start
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
