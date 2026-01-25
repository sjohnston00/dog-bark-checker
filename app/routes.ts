import { index, route, type RouteConfig } from '@react-router/dev/routes'

export default [
  index('routes/index.tsx'),

  // Devices
  route('/devices', 'routes/devices.index.tsx'),
  route('/devices/new', 'routes/devices.new.tsx'),
  route('/devices/:id', 'routes/devices.$id.tsx'),

  // Recordings
  route('/recordings', 'routes/recordings.index.tsx')
] satisfies RouteConfig
