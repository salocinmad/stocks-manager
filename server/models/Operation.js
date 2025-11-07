import mongoose from 'mongoose';

const operationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true // Índice para búsquedas rápidas por usuario
  },
  type: {
    type: String,
    required: true,
    enum: ['purchase', 'sale']
  },
  company: {
    type: String,
    required: true
  },
  symbol: {
    type: String,
    default: ''
  },
  shares: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'EUR'
  },
  exchangeRate: {
    type: Number,
    required: true,
    default: 1
  },
  commission: {
    type: Number,
    default: 0,
    min: 0
  },
  totalCost: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  }
}, {
  timestamps: true // Añade createdAt y updatedAt automáticamente
});

export default mongoose.model('Operation', operationSchema);

