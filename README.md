# Dog Barking Tracking

Coco is really bad at being left home alone and being in a semi detached property doesn't help the case. Therefore I've built this tracker that to listen in on our home IP cameras and using the YAMNET Audio AI Models to detect barking sounds then tracking in a database. My hope is that with increased exposure to being home alone the barking will reduce. This web app will serve as a analytics tracker

# Running

`node enhanced-bark-tracker.cjs stream '<rtsp-url>' --model yamnet`

## TODOs

- create recordings DB table
  - id
  - date
  - startTime
  - endTime (will be NULL if the status is "recording")
  - notes
  - createdAt
  - status
  - updatedAt
  - modelUsed
- get recordings from DB

- create table for detections
  - id
  - timestamp
  - confidence
  - duration
  - source
  - modelUsed
  - audioFeatures
  - ensembleInfo
  - createdAt
  - recordingId (foreignKey)
- add dialog for creating new recording
- add dialog to amend recording
- create DB table for devices
  - id
  - name
  - rtspUrl
  - createdDate
  - updatedDate
  - enabled
- add page for creating devices
- add page for update a device
- add ability to delete a device
- when creating a recording assign it to a device
- live recording
  - start recording button
  - will initiate the `enhanced-bark-tracker.cjs` script
  - will create a recording record in the DB with "recording" status
  - only 1 recording can be in happening at a time on a device
  - will render a stop recording button if there is a "recording" status record currently in the DB
  - SSE events will be sent as ticks regardless of wether barks are detected
  - this will update the chart UI
  - if the user refreshes the page we'll have to get the currently detected barks in this recording
  - when stop recording button pressed update the status to "completed"
- when recording save to a .wav file to be saved on the server
- bundle ffmpeg with the application so we don't rely on the user having it installed on their system
  - this also helps us control the version
- could possibly change the streaming from rtsp to another protocol as we don't need to cameras at all just audio.
- some dogs could be moving throughout the house so we might want recordings to include multiple devices
  - the problems then becomes if 2 devices detect the same bark we might need to de-duplicate them

- first get the DB tables how we want them
- then get the creating of devices and recordings from the UI
- then get the actual scripts running as a process from the UI when initiating a recording
  - this will need to persist as a process until we press "stop recroding" so across refreshes, closing sessions, etc
  - we'll have to handle server restarts and other things in the future.
- then load up the pending recordings data onto the UI (user will still need to refresh to get fresh data)
- the connect up the SSE refreshes
