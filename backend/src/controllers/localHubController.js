import LocalServiceItem from '../models/LocalServiceItem.js';

export const getLocalServices = async (req, res) => {
  try {
    const { city, category } = req.query;
    const filter = { status: 'active' };
    if (city) filter.city = { $regex: city, $options: 'i' };
    if (category && category !== 'All') filter.category = category;

    const items = await LocalServiceItem.find(filter).sort({ rating: -1, createdAt: -1 });
    return res.status(200).json({ success: true, count: items.length, data: items });
  } catch (error) {
    console.error('Error fetching local services:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching local services' });
  }
};
