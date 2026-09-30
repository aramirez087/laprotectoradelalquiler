import type { Instrumentation } from 'next'
import { registrarError } from '@/lib/registro-error'

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  registrarError('request_error', error, {
    route: context.routePath, routeType: context.routeType, method: request.method,
  })
}
