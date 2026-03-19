import { index, route, type RouteConfig } from '@react-router/dev/routes'

export default [
  index('routes/index.tsx'),

  // Devices
  route('/devices', 'routes/devices.index.tsx'),
  route('/devices/new', 'routes/devices.new.tsx'),
  route('/devices/:id', 'routes/devices.$id.tsx'),

  // Recordings
  route('/recordings', 'routes/recordings.index.tsx'),
  route('/recordings/:id', 'routes/recordings.$id.tsx'),
  route('/recordings/:id/sse', 'routes/recordings.$id.sse.ts'),

  route('/streamSubscription', 'routes/streamSubscription.tsx'),
  route('/stream', 'routes/stream.ts'),
  route('/stream/:id', 'routes/stream.$id.ts'),
] satisfies RouteConfig
