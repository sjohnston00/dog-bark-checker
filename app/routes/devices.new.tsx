import React from 'react'
import type { Route } from './+types/devices.new'
import { data, Form, Link, redirect } from 'react-router'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Button } from '~/components/ui/button'
import { Heading } from '~/components/ui/heading'
import DevicesRepository from '~/utils/DevicesRepository.server'
import db from '~/utils/db.server'

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()

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
  deviceRepo.create({
    name,
    rtspUrl,
  })

  throw redirect('/devices')
}

export default function Page({ actionData }: Route.ComponentProps) {
  const errorMessage = actionData?.error
  return (
    <div className='ms-4'>
      <Heading>New Device</Heading>
      <Form method='post' className='lg:max-w-sm mt-4 flex flex-col gap-2'>
        {errorMessage && (
          <div className='alert alert-error'>
            <span>{errorMessage}</span>
          </div>
        )}
        <div>
          <Label htmlFor='name'>Name</Label>
          <Input name='name' id='name' type='text' required />
        </div>
        <div>
          <Label htmlFor='rtspUrl'>RTSP URL</Label>
          <Input name='rtspUrl' id='rtspUrl' type='text' required />
        </div>
        <div className='flex items-center gap-2 mt-4'>
          <Link className='btn btn-ghost flex-1' to={'/devices'}>
            Back
          </Link>
          <Button type='submit' className='flex-1' variant={'primary'}>
            Create
          </Button>
        </div>
      </Form>
    </div>
  )
}
