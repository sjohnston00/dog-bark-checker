import React from 'react'
import type { Route } from './+types/devices.$id'
import { data, Form, Link, redirect } from 'react-router'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Button } from '~/components/ui/button'
import { Heading } from '~/components/ui/heading'
import DevicesRepository from '~/utils/DevicesRepository.server'
import db from '~/utils/db.server'

export async function loader({ params }: Route.LoaderArgs) {
  const id = Number(params.id)

  if (!id) {
    throw data('Device not found', { status: 404 })
  }

  const deviceRepo = new DevicesRepository({ db: db })
  const device = deviceRepo.getById(id)

  if (!device) {
    throw data('Device not found', { status: 404 })
  }

  return data({
    device,
  })
}

export async function action({ request, params }: Route.ActionArgs) {
  const id = Number(params.id)

  if (!id) {
    throw data('Device not found', { status: 404 })
  }

  const formData = await request.formData()

  const formAction = formData.get('_action')?.toString()

  if (formAction === 'delete-device') {
    const deviceRepo = new DevicesRepository({ db: db })
    deviceRepo.deleteById(id)

    throw redirect('/devices')
  }

  const name = formData.get('name')?.toString().trim()
  const rtspUrl = formData.get('rtspUrl')?.toString().trim()

  if (!name) {
    return data(
      {
        error: 'Name is required',
      },
      { status: 400 }
    )
  }

  if (!rtspUrl) {
    return data(
      {
        error: 'RTSP URL is required',
      },
      { status: 400 }
    )
  }

  const deviceRepo = new DevicesRepository({ db: db })
  deviceRepo.updateById(id, {
    name,
    rtspUrl,
  })

  throw redirect('/devices')
}

export default function Page({ loaderData, actionData }: Route.ComponentProps) {
  const { device } = loaderData
  const errorMessage = actionData?.error
  return (
    <div className='ms-4'>
      <Heading>Update Device</Heading>
      <Form method='post' className='lg:max-w-sm mt-4 flex flex-col gap-2'>
        {errorMessage && (
          <div className='alert alert-error'>
            <span>{errorMessage}</span>
          </div>
        )}
        <div>
          <Label htmlFor='name'>Name</Label>
          <Input
            name='name'
            id='name'
            type='text'
            defaultValue={device.name}
            required
          />
        </div>
        <div>
          <Label htmlFor='rtspUrl'>RTSP URL</Label>
          <Input
            name='rtspUrl'
            id='rtspUrl'
            type='text'
            defaultValue={device.rtspUrl}
            required
          />
        </div>
        <div className='flex items-center gap-2 mt-4'>
          <Link className='btn btn-ghost flex-1' to={'/devices'}>
            Back
          </Link>

          <Button type='submit' className='flex-1' variant={'accent'}>
            Update
          </Button>
        </div>
      </Form>
      <hr className='divider opacity-30' />
      <Heading size={'h3'} className='text-error'>
        Delete device
      </Heading>
      <Form className='lg:max-w-sm' method='post'>
        <div className='alert alert-soft alert-error my-4'>
          <span>
            Will remove it from the system. This action cannot be undone.
          </span>
        </div>
        <input type='hidden' name='_action' value={'delete-device'} />
        <Button type='submit' className='flex-1' variant={'error'}>
          Delete
        </Button>
      </Form>
    </div>
  )
}
