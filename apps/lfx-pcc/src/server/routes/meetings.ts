// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { NextFunction, Request, Response, Router } from 'express';

import { SupabaseService } from '../services/supabase.service';

const router = Router();

const supabaseService = new SupabaseService();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const meetings = await supabaseService.getMeetings(req.query as Record<string, any>);

    return res.json(meetings);
  } catch (error) {
    console.error('Failed to fetch meetings:', error);
    return next(error);
  }
});

router.get('/:id/participants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const meetingId = req.params['id'];

    if (!meetingId) {
      return res.status(400).json({
        error: 'Meeting ID is required',
        code: 'MISSING_MEETING_ID',
      });
    }

    const participants = await supabaseService.getMeetingParticipants(meetingId);

    return res.json(participants);
  } catch (error) {
    console.error(`Failed to fetch participants for meeting ${req.params['id']}:`, error);
    return next(error);
  }
});

router.post('/:id/participants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const meetingId = req.params['id'];
    const participantData = req.body;

    if (!meetingId) {
      return res.status(400).json({
        error: 'Meeting ID is required',
        code: 'MISSING_MEETING_ID',
      });
    }

    // Basic validation
    if (!participantData.first_name || !participantData.last_name || !participantData.email) {
      return res.status(400).json({
        error: 'First name, last name, and email are required fields',
        code: 'MISSING_REQUIRED_FIELDS',
      });
    }

    const participant = await supabaseService.addMeetingParticipant(meetingId, participantData);

    return res.status(201).json(participant);
  } catch (error) {
    console.error(`Failed to add participant to meeting ${req.params['id']}:`, error);
    return next(error);
  }
});

router.put('/:id/participants/:participantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const meetingId = req.params['id'];
    const participantId = req.params['participantId'];
    const participantData = req.body;

    if (!meetingId) {
      return res.status(400).json({
        error: 'Meeting ID is required',
        code: 'MISSING_MEETING_ID',
      });
    }

    if (!participantId) {
      return res.status(400).json({
        error: 'Participant ID is required',
        code: 'MISSING_PARTICIPANT_ID',
      });
    }

    // Basic validation
    if (!participantData.first_name || !participantData.last_name || !participantData.email) {
      return res.status(400).json({
        error: 'First name, last name, and email are required fields',
        code: 'MISSING_REQUIRED_FIELDS',
      });
    }

    // Remove fields that shouldn't be updated directly
    delete participantData.id;
    delete participantData.meeting_id;
    delete participantData.created_at;

    const participant = await supabaseService.updateMeetingParticipant(meetingId, participantId, participantData);

    return res.json(participant);
  } catch (error) {
    console.error(`Failed to update participant ${req.params['participantId']} in meeting ${req.params['id']}:`, error);
    return next(error);
  }
});

router.delete('/:id/participants/:participantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const meetingId = req.params['id'];
    const participantId = req.params['participantId'];

    if (!meetingId) {
      return res.status(400).json({
        error: 'Meeting ID is required',
        code: 'MISSING_MEETING_ID',
      });
    }

    if (!participantId) {
      return res.status(400).json({
        error: 'Participant ID is required',
        code: 'MISSING_PARTICIPANT_ID',
      });
    }

    await supabaseService.deleteMeetingParticipant(meetingId, participantId);

    return res.status(204).send();
  } catch (error) {
    console.error(`Failed to delete participant ${req.params['participantId']} from meeting ${req.params['id']}:`, error);
    return next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const meetingId = req.params['id'];

    if (!meetingId) {
      return res.status(400).json({
        error: 'Meeting ID is required',
        code: 'MISSING_MEETING_ID',
      });
    }

    const meeting = await supabaseService.getMeetingById(meetingId);

    return res.json(meeting);
  } catch (error) {
    console.error(`Failed to fetch meeting ${req.params['id']}:`, error);
    return next(error);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const meetingData = req.body;

    // Basic validation
    if (!meetingData.topic || !meetingData.start_time || !meetingData.project_uid || !meetingData.duration) {
      return res.status(400).json({
        error: 'Topic, start_time, duration, and project_uid are required fields',
        code: 'MISSING_REQUIRED_FIELDS',
      });
    }

    const meeting = await supabaseService.createMeeting(meetingData);

    return res.status(201).json(meeting);
  } catch (error) {
    console.error('Failed to create meeting:', error);
    return next(error);
  }
});

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const meetingId = req.params['id'];
    const meetingData = req.body;
    const { editType } = req.query;

    if (!meetingId) {
      return res.status(400).json({
        error: 'Meeting ID is required',
        code: 'MISSING_MEETING_ID',
      });
    }

    // Validate editType for recurring meetings
    if (editType && !['single', 'future'].includes(editType as string)) {
      return res.status(400).json({
        error: 'Edit type must be "single" or "future"',
        code: 'INVALID_EDIT_TYPE',
      });
    }

    // Remove fields that shouldn't be updated directly
    delete meetingData.id;
    delete meetingData.created_at;

    const meeting = await supabaseService.updateMeeting(meetingId, meetingData, editType as 'single' | 'future');

    return res.json(meeting);
  } catch (error) {
    console.error(`Failed to update meeting ${req.params['id']}:`, error);
    return next(error);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const meetingId = req.params['id'];
    const { deleteType } = req.query;

    if (!meetingId) {
      return res.status(400).json({
        error: 'Meeting ID is required',
        code: 'MISSING_MEETING_ID',
      });
    }

    // Validate deleteType for recurring meetings
    if (deleteType && !['single', 'series', 'future'].includes(deleteType as string)) {
      return res.status(400).json({
        error: 'Delete type must be "single", "series", or "future"',
        code: 'INVALID_DELETE_TYPE',
      });
    }

    await supabaseService.deleteMeeting(meetingId, deleteType as 'single' | 'series' | 'future');

    return res.status(204).send();
  } catch (error) {
    console.error(`Failed to delete meeting ${req.params['id']}:`, error);
    return next(error);
  }
});

export default router;
