import express from 'express';
import authMiddleware from '../middleware/authMiddleware';
import {
  createJournalEntry,
  deleteJournalEntry,
  listJournalEntries,
  updateJournalEntry
} from '../controllers/journalController';

const router = express.Router();

router.use(authMiddleware);

router.get('/', listJournalEntries);
router.post('/', createJournalEntry);
router.patch('/:id', updateJournalEntry);
router.delete('/:id', deleteJournalEntry);

export default router;
