import axios from 'axios';

const API_URL = '/api/notifications';

const notificationAPI = {
  sendStopLossEmail: async (data) => {
    try {
      const response = await axios.post(`${API_URL}/stop-loss`, data);
      return response.data;
    } catch (error) {
      console.error('Error sending stop loss email:', error);
      throw error;
    }
  },
};

export default notificationAPI;
