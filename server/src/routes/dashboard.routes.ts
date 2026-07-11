import { Router } from 'express'
import { sendSuccess } from '../middleware/response.js'
import { dashboardData } from '../services/dashboard.service.js'

export const dashboardRouter = Router()

dashboardRouter.get('/', (_req, res) => {
  sendSuccess(res, dashboardData)
})
