import PilgrimageCircuit from '../models/PilgrimageCircuit.js';
import Temple from '../models/Temple.js';
import EventFestival from '../models/EventFestival.js';
import SacredDirectoryItem from '../models/SacredDirectoryItem.js';

// ─── Pilgrimage Circuits Controllers ──────────────────────────────────────────
export const getPilgrimageCircuits = async (req, res) => {
  try {
    const { circuitType, search } = req.query;
    const filter = { status: 'active' };
    if (circuitType && circuitType !== 'All') {
      filter.circuitType = circuitType;
    }
    if (search) {
      filter.title = { $regex: search, $options: 'i' };
    }
    const circuits = await PilgrimageCircuit.find(filter).sort({ displayOrder: 1, createdAt: -1 });
    return res.status(200).json({ success: true, count: circuits.length, data: circuits });
  } catch (error) {
    console.error('Error fetching pilgrimage circuits:', error);
    return res.status(500).json({ success: false, message: 'Server Error fetching circuits' });
  }
};

export const getPilgrimageCircuitBySlug = async (req, res) => {
  try {
    const circuit = await PilgrimageCircuit.findOne({ slug: req.params.slug, status: 'active' });
    if (!circuit) {
      return res.status(404).json({ success: false, message: 'Pilgrimage Circuit not found' });
    }
    return res.status(200).json({ success: true, data: circuit });
  } catch (error) {
    console.error('Error fetching circuit detail:', error);
    return res.status(500).json({ success: false, message: 'Server Error fetching circuit detail' });
  }
};

// ─── Temples Controllers ───────────────────────────────────────────────────────
export const getTemples = async (req, res) => {
  try {
    const { city, state, search } = req.query;
    const filter = { status: 'active' };
    if (city) filter.city = { $regex: city, $options: 'i' };
    if (state) filter.state = { $regex: state, $options: 'i' };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { deity: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
      ];
    }
    const temples = await Temple.find(filter).sort({ rating: -1, createdAt: -1 });
    return res.status(200).json({ success: true, count: temples.length, data: temples });
  } catch (error) {
    console.error('Error fetching temples:', error);
    return res.status(500).json({ success: false, message: 'Server Error fetching temples' });
  }
};

export const getTempleBySlug = async (req, res) => {
  try {
    const temple = await Temple.findOne({ slug: req.params.slug, status: 'active' });
    if (!temple) {
      return res.status(404).json({ success: false, message: 'Temple not found' });
    }
    return res.status(200).json({ success: true, data: temple });
  } catch (error) {
    console.error('Error fetching temple detail:', error);
    return res.status(500).json({ success: false, message: 'Server Error fetching temple detail' });
  }
};

// ─── Events & Festivals Controllers ───────────────────────────────────────────
export const getEventFestivals = async (req, res) => {
  try {
    const { eventType, search } = req.query;
    const filter = {};
    if (eventType && eventType !== 'All') filter.eventType = eventType;
    if (search) filter.title = { $regex: search, $options: 'i' };
    const events = await EventFestival.find(filter).sort({ startDate: 1 });
    return res.status(200).json({ success: true, count: events.length, data: events });
  } catch (error) {
    console.error('Error fetching events & festivals:', error);
    return res.status(500).json({ success: false, message: 'Server Error fetching events' });
  }
};

export const getEventFestivalBySlug = async (req, res) => {
  try {
    const eventItem = await EventFestival.findOne({ slug: req.params.slug });
    if (!eventItem) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    return res.status(200).json({ success: true, data: eventItem });
  } catch (error) {
    console.error('Error fetching event detail:', error);
    return res.status(500).json({ success: false, message: 'Server Error fetching event detail' });
  }
};

// ─── Directory Items Controllers (Generic for 9 Modules) ─────────────────────
export const getDirectoryItems = async (req, res) => {
  try {
    const { moduleType, category, search } = req.query;
    const filter = { status: 'active' };
    if (moduleType) filter.moduleType = moduleType;
    if (category && category !== 'All') filter.category = category;
    if (search) filter.title = { $regex: search, $options: 'i' };

    const items = await SacredDirectoryItem.find(filter).sort({ rating: -1, createdAt: -1 });
    return res.status(200).json({ success: true, count: items.length, data: items });
  } catch (error) {
    console.error('Error fetching directory items:', error);
    return res.status(500).json({ success: false, message: 'Server Error fetching directory items' });
  }
};
