import React from "react";
import { Heading } from "~/components/ui/heading";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import type { Route } from "./+types/recordings.index";
import db from "~/utils/db.server";
import DevicesRepository from "~/utils/DevicesRepository.server";
import { data, Form, Link } from "react-router";
import { Label } from "~/components/ui/label";
import RecordingsRepository from "~/utils/RecordingsRepository.server";
import { BanIcon, CircleStop, EyeIcon } from "lucide-react";
import { createSession, stopRecording } from "~/utils/recordingsMap.server";
import { formatDuration, intervalToDuration } from "date-fns";
import StatusBadge from "~/components/ui/statusBadge";

export async function loader({}: Route.LoaderArgs) {
  const devicesRepo = new DevicesRepository({ db: db });
  const recordingsRepo = new RecordingsRepository({ db: db });
  const devices = devicesRepo.getAll();
  const recordings = recordingsRepo.getAll();

  return data({
    devices,
    recordings,
    isCurrentlyRecording: recordings.some((r: any) => r.status === "pending"),
  });
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const formAction = formData.get("_action")?.toString();

  const recordingsRepo = new RecordingsRepository({ db: db });

  switch (formAction) {
    case "stop-recording":
      const recordingIdToStop = Number(formData.get("recordingId"));
      if (!recordingIdToStop) {
        throw data("Recording ID not found", { status: 400 });
      }
      const recordingToStop = recordingsRepo.getById(recordingIdToStop);
      if (!recordingToStop) {
        throw data("Recording not found", { status: 400 });
      }

      // recordingsRepo.update(recordingIdToStop, {
      //   status: "completed",
      //   endTime: new Date().toISOString(),
      // });
      stopRecording(recordingIdToStop);

      //await 1 second to ensure the process has stopped
      await new Promise((res, rej) => setTimeout(res, 1000));

      return null;
    case "cancel-recording":
      const recordingId = Number(formData.get("recordingId"));
      if (!recordingId) {
        throw data("Recording ID not found", { status: 400 });
      }
      const recording = recordingsRepo.getById(recordingId);
      if (!recording) {
        throw data("Recording not found", { status: 400 });
      }
      recordingsRepo.update(recordingId, {
        status: "cancelled",
      });
      return null;

    case "create-recording":
      const deviceId = Number(formData.get("deviceId"));

      if (!deviceId) {
        throw data("Device ID not found", { status: 400 });
      }

      //validate deviceId exists
      const devicesRepo = new DevicesRepository({ db: db });
      const device = devicesRepo.getById(deviceId);

      if (!device) {
        throw data("Device not found", { status: 400 });
      }

      // Here you would normally start the recording process for the selected device.
      const today = new Date();
      const newRecordingId = recordingsRepo.create({
        status: "pending",
        date: today.toISOString(),
        startTime: today.toISOString(),
        deviceId,
      });

      createSession(newRecordingId);

      return null;
    default:
      throw data("not a valid form action", { status: 400 });
  }
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const { devices, recordings, isCurrentlyRecording } = loaderData;
  return (
    <div>
      <Heading>Recordings</Heading>
      <div className="alert alert-soft my-4">
        <span>View recordings from devices.</span>
      </div>

      <Dialog>
        <DialogTrigger asChild disabled={isCurrentlyRecording}>
          <Button variant="primary">Start recording</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start recording</DialogTitle>
          </DialogHeader>
          <p>Would you like to start recording a session on a device?</p>
          <Form method="post" id="start-recording-form">
            <Label>Device</Label>
            <select
              name="deviceId"
              className="select w-full mt-2 mb-4"
              required
            >
              {devices.map((device: any) => (
                <option key={device.id} value={device.id}>
                  {device.name}
                </option>
              ))}
            </select>
          </Form>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" btnStyle={"ghost"}>
                Close
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button
                type="submit"
                form="start-recording-form"
                name="_action"
                value="create-recording"
                variant={"primary"}
              >
                Start
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <table className="table w-full">
        <thead>
          <tr>
            <th>StartTime</th>
            <th>EndTime</th>
            <th>Status</th>
            <th>Device</th>
            <th>Detections</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {recordings.map((r: any) => {
            const isRecordingPending = r.status === "pending";
            const device = devices.find((d) => d.id === r.deviceId);
            const duration = r.endTime
              ? formatDuration(
                  intervalToDuration({ start: r.startTime, end: r.endTime })
                )
              : null;
            return (
              <tr
                key={r.id}
                className={isRecordingPending ? "bg-warning/50" : ""}
              >
                <td>{new Date(r.startTime).toLocaleString()}</td>
                <td>{duration}</td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td>
                  {device ? (
                    <Link
                      to={`/devices/${device.id}`}
                      className="hover:underline"
                    >
                      {device.name}
                    </Link>
                  ) : (
                    "null"
                  )}
                </td>
                <td>0</td>
                <td>
                  <div className="flex items-center gap-2">
                    <Link to={`/recordings/${r.id}`} className="btn">
                      <EyeIcon />
                    </Link>
                    {isRecordingPending ? (
                      <Form method="post" className="flex items-center gap-2">
                        <input type="hidden" name="recordingId" value={r.id} />
                        <Button
                          type="submit"
                          name="_action"
                          value="stop-recording"
                          btnStyle={"outline"}
                          variant={"error"}
                          title="Stop"
                        >
                          <CircleStop />
                        </Button>
                        <Button
                          type="submit"
                          name="_action"
                          value="cancel-recording"
                          variant={"error"}
                          title="Cancel"
                        >
                          <BanIcon />
                        </Button>
                      </Form>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
