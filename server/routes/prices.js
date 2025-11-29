import express from 'express'
import { authenticate } from '../middleware/auth.js'
import PriceCache from '../models/PriceCache.js'
import GlobalCurrentPrice from '../models/GlobalCurrentPrice.js'
import Operation from '../models/Operation.js'
import Portfolio from '../models/Portfolio.js'
import User from '../models/User.js'
import Config from '../models/Config.js'
import { sendNotification } from '../services/notify.js'
import { getSymbolFromPositionKey } from '../utils/symbolHelpers.js'

const router = express.Router()

router.use(authenticate)



