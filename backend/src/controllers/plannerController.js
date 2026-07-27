import PlannerTemplate from '../models/PlannerTemplate.js';
import TripItinerary from '../models/TripItinerary.js';

export const generateItinerary = async (req, res) => {
  try {
    const { destination, purpose, startCity, travelDate, durationDays, adults, children, seniorCitizens, budgetType, preferences } = req.body;

    const newItinerary = await TripItinerary.create({
      destination: destination || 'Kedarnath & Char Dham',
      purpose: purpose || 'Pilgrimage & Darshan',
      startCity: startCity || 'Haridwar',
      travelDate: travelDate || new Date().toISOString().split('T')[0],
      durationDays: durationDays || 7,
      adults: adults || 2,
      children: children || 0,
      seniorCitizens: seniorCitizens || 0,
      budgetType: budgetType || 'Standard',
      preferences: preferences || {},
      totalEstimatedCost: (durationDays || 7) * 2800,
    });

    return res.status(201).json({ success: true, message: 'Itinerary generated successfully', data: newItinerary });
  } catch (error) {
    console.error('Error generating itinerary:', error);
    return res.status(500).json({ success: false, message: 'Server error generating itinerary' });
  }
};

export const getPlannerTemplates = async (req, res) => {
  try {
    const templates = await PlannerTemplate.find({ status: 'active' });
    return res.status(200).json({ success: true, count: templates.length, data: templates });
  } catch (error) {
    console.error('Error fetching planner templates:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching templates' });
  }
};
