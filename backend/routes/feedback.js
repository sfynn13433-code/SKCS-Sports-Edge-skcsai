'use strict';

const express = require('express');
const { query } = require('../database');
const { requireRole } = require('../utils/auth');
const { requireSupabaseUser } = require('../middleware/supabaseJwt');

const router = express.Router();

function sanitizeDisplayName(value, fallback = 'SKCS User') {
    const raw = String(value || '').trim().replace(/\s+/g, ' ');
    if (!raw) return fallback;
    const first = raw.split(' ')[0];
    return first.slice(0, 40) || fallback;
}

function sanitizeComment(value) {
    return String(value || '').trim().slice(0, 1000);
}

function normalizeRating(value) {
    const rating = Number(value);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
    return rating;
}

function mapPublicRow(row) {
    return {
        id: row.id,
        display_name: row.display_name,
        rating: Number(row.rating),
        comment: row.comment,
        created_at: row.created_at
    };
}

router.get('/public', async (_req, res) => {
    try {
        const result = await query(
            `
            SELECT id, display_name, rating, comment, created_at
            FROM user_experience_feedback
            WHERE status = 'approved'
            ORDER BY created_at DESC
            LIMIT 24
            `
        );

        return res.json({
            ok: true,
            count: result.rows.length,
            feedback: result.rows.map(mapPublicRow)
        });
    } catch (err) {
        console.error('[feedback/public] error:', err.message);
        return res.status(500).json({ ok: false, error: 'Failed to load public feedback' });
    }
});

router.post('/', requireRole('user'), requireSupabaseUser, async (req, res) => {
    try {
        const rating = normalizeRating(req.body?.rating);
        const comment = sanitizeComment(req.body?.comment);
        const displayName = sanitizeDisplayName(
            req.body?.display_name || req.user?.first_name,
            'SKCS User'
        );

        if (!rating) {
            return res.status(400).json({ ok: false, error: 'Rating must be between 1 and 5' });
        }
        if (comment.length < 10) {
            return res.status(400).json({ ok: false, error: 'Comment must be at least 10 characters' });
        }

        const userId = String(req.user?.id || '').trim();
        if (!userId || userId === 'api-key-user') {
            return res.status(401).json({
                ok: false,
                error: 'Please sign in with your SKCS account before submitting feedback'
            });
        }

        const duplicateCheck = await query(
            `
            SELECT id
            FROM user_experience_feedback
            WHERE user_id = $1::uuid
              AND status = 'pending'
            LIMIT 1
            `,
            [userId]
        );

        if (duplicateCheck.rows.length > 0) {
            return res.status(409).json({
                ok: false,
                error: 'You already have feedback awaiting review. We will publish it after approval.'
            });
        }

        const insert = await query(
            `
            INSERT INTO user_experience_feedback (
                user_id,
                user_email,
                display_name,
                rating,
                comment,
                status
            )
            VALUES ($1::uuid, $2, $3, $4, $5, 'pending')
            RETURNING id, display_name, rating, comment, status, created_at
            `,
            [userId, req.user?.email || null, displayName, rating, comment]
        );

        return res.status(201).json({
            ok: true,
            message: 'Thank you. Your feedback was submitted and will appear on the homepage after manual approval.',
            feedback: insert.rows[0]
        });
    } catch (err) {
        console.error('[feedback/submit] error:', err.message);
        return res.status(500).json({ ok: false, error: 'Failed to submit feedback' });
    }
});

router.get('/admin/pending', requireRole('admin'), async (_req, res) => {
    try {
        const result = await query(
            `
            SELECT id, user_id, user_email, display_name, rating, comment, status, created_at
            FROM user_experience_feedback
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT 100
            `
        );

        return res.json({
            ok: true,
            count: result.rows.length,
            feedback: result.rows
        });
    } catch (err) {
        console.error('[feedback/admin/pending] error:', err.message);
        return res.status(500).json({ ok: false, error: 'Failed to load pending feedback' });
    }
});

router.patch('/admin/:id/approve', requireRole('admin'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).json({ ok: false, error: 'Invalid feedback id' });
        }

        const result = await query(
            `
            UPDATE user_experience_feedback
            SET status = 'approved',
                moderated_by = $2,
                moderated_at = now(),
                updated_at = now()
            WHERE id = $1
              AND status = 'pending'
            RETURNING id, display_name, rating, comment, status, created_at
            `,
            [id, 'admin_api']
        );

        if (!result.rows.length) {
            return res.status(404).json({ ok: false, error: 'Pending feedback not found' });
        }

        return res.json({ ok: true, feedback: mapPublicRow(result.rows[0]) });
    } catch (err) {
        console.error('[feedback/admin/approve] error:', err.message);
        return res.status(500).json({ ok: false, error: 'Failed to approve feedback' });
    }
});

router.patch('/admin/:id/reject', requireRole('admin'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).json({ ok: false, error: 'Invalid feedback id' });
        }

        const note = sanitizeComment(req.body?.note || '').slice(0, 240) || null;

        const result = await query(
            `
            UPDATE user_experience_feedback
            SET status = 'rejected',
                moderated_by = $2,
                moderated_at = now(),
                moderation_note = $3,
                updated_at = now()
            WHERE id = $1
              AND status = 'pending'
            RETURNING id, status
            `,
            [id, 'admin_api', note]
        );

        if (!result.rows.length) {
            return res.status(404).json({ ok: false, error: 'Pending feedback not found' });
        }

        return res.json({ ok: true, feedback: result.rows[0] });
    } catch (err) {
        console.error('[feedback/admin/reject] error:', err.message);
        return res.status(500).json({ ok: false, error: 'Failed to reject feedback' });
    }
});

module.exports = router;
