import SupportTicket from '../models/SupportTicket.js';
import AuditLog from '../models/AuditLog.js';

// @desc    Create a support ticket
// @route   POST /api/support
// @access  Private (Customer / Owner / Manager)
export const createTicket = async (req, res) => {
  try {
    const { title, description, category } = req.body;

    const ticket = await SupportTicket.create({
      userId: req.user.id,
      title,
      description,
      category,
      status: 'open',
    });

    await AuditLog.create({
      userId: req.user.id,
      action: 'SUPPORT_TICKET_CREATE',
      module: 'SUPPORT',
      details: { ticketId: ticket._id, category },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error('Create support ticket error:', error);
    res.status(500).json({ success: false, message: 'Server error creating support ticket' });
  }
};

// @desc    Get support tickets list
// @route   GET /api/support
// @access  Private (Customer, Support Executive, Admin)
export const getTickets = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'customer') {
      query.userId = req.user.id;
    } else if (req.user.role === 'support') {
      // Show unassigned or tickets assigned to them
      query.$or = [{ assignedTo: req.user.id }, { assignedTo: { $exists: false } }];
    }

    const tickets = await SupportTicket.find(query)
      .populate('userId', 'name email phone')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: tickets,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error retrieving support tickets' });
  }
};

// @desc    Add a message to a ticket
// @route   POST /api/support/:id/message
// @access  Private (Customer / Support / Admin)
export const addMessageToTicket = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, message: 'Message text is required' });
    }

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    // Check permissions
    if (req.user.role === 'customer' && ticket.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to comment on this ticket' });
    }

    // Assign support agent if they are commenting
    if (req.user.role === 'support' && !ticket.assignedTo) {
      ticket.assignedTo = req.user.id;
      ticket.status = 'in_progress';
    }

    ticket.messages.push({
      senderId: req.user.id,
      text,
      timestamp: new Date(),
    });

    await ticket.save();

    res.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error('Add message error:', error);
    res.status(500).json({ success: false, message: 'Server error responding to ticket' });
  }
};

// @desc    Mark support ticket as resolved
// @route   POST /api/support/:id/resolve
// @access  Private (Support / Admin / Owner of ticket)
export const resolveTicket = async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (req.user.role === 'customer' && ticket.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    ticket.status = 'resolved';
    await ticket.save();

    await AuditLog.create({
      userId: req.user.id,
      action: 'SUPPORT_TICKET_RESOLVED',
      module: 'SUPPORT',
      details: { ticketId: ticket._id },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Ticket successfully marked as resolved',
      data: ticket,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error resolving support ticket' });
  }
};
