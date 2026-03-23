const express = require("express");
const router = express.Router();
const pool = require("../db");
const { startMwlDimseScp, stopMwlDimseScp } = require("../services/mwlDimseScp");

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "0.0.0.0"]);

function isLocalDimseRow(row) {
  const protocol = String(row.manual_protocol || row.manual_type || "")
    .trim()
    .toUpperCase();
  if (protocol !== "DIMSE") return false;
  const host = String(row.manual_host || "").trim().toLowerCase();
  return !host || LOCAL_HOSTS.has(host);
}

async function syncLocalDimseScpState() {
  await ensureMwlTargetsTable();
  const result = await pool.query(
    `
    SELECT manual_protocol, manual_type, manual_host, is_active
    FROM mwl_modality_targets
    WHERE is_active = true
    `
  );
  const hasLocalDimse = (result.rows || []).some(isLocalDimseRow);
  if (hasLocalDimse) startMwlDimseScp();
  else stopMwlDimseScp();
}

async function ensureMwlTargetsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mwl_modality_targets (
      id SERIAL PRIMARY KEY,
      modality_code VARCHAR(16) NOT NULL,
      pacs_id INTEGER REFERENCES pacs(id) ON DELETE SET NULL,
      orthanc_modality_name VARCHAR(64),
      manual_host VARCHAR(128),
      manual_port INTEGER,
      manual_ae_title VARCHAR(64),
      manual_type VARCHAR(32),
      manual_protocol VARCHAR(16),
      manual_calling_ae VARCHAR(64),
      manual_called_ae VARCHAR(64),
      viewer_protocol VARCHAR(32),
      viewer_base_url VARCHAR(256),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    DO $$
    DECLARE constraint_name text;
    BEGIN
      SELECT c.conname INTO constraint_name
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE t.relname = 'mwl_modality_targets'
        AND n.nspname = 'public'
        AND c.contype = 'u'
        AND pg_get_constraintdef(c.oid) ILIKE '%(modality_code)%'
      LIMIT 1;

      IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE mwl_modality_targets DROP CONSTRAINT ' || quote_ident(constraint_name);
      END IF;
    END $$;
  `);
  await pool.query("ALTER TABLE mwl_modality_targets ADD COLUMN IF NOT EXISTS manual_host VARCHAR(128)");
  await pool.query("ALTER TABLE mwl_modality_targets ADD COLUMN IF NOT EXISTS manual_port INTEGER");
  await pool.query("ALTER TABLE mwl_modality_targets ADD COLUMN IF NOT EXISTS manual_ae_title VARCHAR(64)");
  await pool.query("ALTER TABLE mwl_modality_targets ADD COLUMN IF NOT EXISTS manual_type VARCHAR(32)");
  await pool.query("ALTER TABLE mwl_modality_targets ADD COLUMN IF NOT EXISTS manual_protocol VARCHAR(16)");
  await pool.query("ALTER TABLE mwl_modality_targets ADD COLUMN IF NOT EXISTS manual_calling_ae VARCHAR(64)");
  await pool.query("ALTER TABLE mwl_modality_targets ADD COLUMN IF NOT EXISTS manual_called_ae VARCHAR(64)");
  await pool.query("ALTER TABLE mwl_modality_targets ADD COLUMN IF NOT EXISTS viewer_protocol VARCHAR(32)");
  await pool.query("ALTER TABLE mwl_modality_targets ADD COLUMN IF NOT EXISTS viewer_base_url VARCHAR(256)");
}

router.get("/options", async (req, res) => {
  try {
    await ensureMwlTargetsTable();
    const [modalitiesRes, pacsRes] = await Promise.all([
      pool.query(
        "SELECT id, code, name FROM modalities WHERE is_active = true ORDER BY id"
      ),
      pool.query(
        "SELECT id, pacs_name, ae_title, ip_address, port, is_active FROM pacs ORDER BY id"
      ),
    ]);
    return res.json({
      success: true,
      modalities: modalitiesRes.rows,
      pacs: pacsRes.rows,
    });
  } catch (err) {
    console.error("MWL target options error:", err.message);
    return res.status(500).json({ success: false, error: "Failed to load MWL options" });
  }
});

router.get("/", async (req, res) => {
  try {
    await ensureMwlTargetsTable();
    const result = await pool.query(
      `
      SELECT
        t.id,
        t.modality_code,
        t.pacs_id,
        t.orthanc_modality_name,
        t.manual_host,
        t.manual_port,
        t.manual_ae_title,
        t.manual_type,
        t.manual_protocol,
        t.manual_calling_ae,
        t.manual_called_ae,
        t.viewer_protocol,
        t.viewer_base_url,
        t.is_active,
        t.updated_at,
        p.pacs_name,
        p.ae_title,
        p.ip_address,
        p.port
      FROM mwl_modality_targets t
      LEFT JOIN pacs p ON p.id = t.pacs_id
      ORDER BY t.modality_code ASC
      `
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("MWL target fetch error:", err.message);
    return res.status(500).json({ success: false, error: "Failed to fetch MWL targets" });
  }
});

router.post("/", async (req, res) => {
  try {
    await ensureMwlTargetsTable();
    const {
      id,
      modality_code,
      pacs_id,
      orthanc_modality_name,
      manual_host,
      manual_port,
      manual_ae_title,
      manual_type,
      manual_protocol,
      manual_calling_ae,
      manual_called_ae,
      viewer_protocol,
      viewer_base_url,
      is_active = true,
    } = req.body || {};
    const modalityCode = String(modality_code || "").trim().toUpperCase() || "ALL";
    const hasManual = String(manual_host || "").trim() && Number(manual_port);
    if (!pacs_id && !hasManual) {
      return res.status(400).json({ success: false, error: "manual_host/manual_port required" });
    }

    if (pacs_id) {
      const pacsRes = await pool.query("SELECT id FROM pacs WHERE id = $1 LIMIT 1", [pacs_id]);
      if (!pacsRes.rows.length) {
        return res.status(400).json({ success: false, error: "Selected PACS not found" });
      }
    }

    if (id) {
      const updated = await pool.query(
        `
        UPDATE mwl_modality_targets
        SET modality_code=$2,
            pacs_id=$3,
            orthanc_modality_name=$4,
            manual_host=$5,
            manual_port=$6,
            manual_ae_title=$7,
            manual_type=$8,
            manual_protocol=$9,
            manual_calling_ae=$10,
            manual_called_ae=$11,
            viewer_protocol=$12,
            viewer_base_url=$13,
            is_active=$14,
            updated_at=NOW()
        WHERE id=$1
        RETURNING *
        `,
        [
          Number(id),
          modalityCode,
          pacs_id ? Number(pacs_id) : null,
          orthanc_modality_name || null,
          manual_host || null,
          manual_port ? Number(manual_port) : null,
          manual_ae_title || null,
          manual_type || null,
          manual_protocol || null,
          manual_calling_ae || null,
          manual_called_ae || null,
          viewer_protocol || null,
          viewer_base_url || null,
          Boolean(is_active),
        ]
      );
      if (!updated.rows.length) {
        return res.status(404).json({ success: false, error: "Mapping not found" });
      }
      await syncLocalDimseScpState();
      return res.json({ success: true, data: updated.rows[0] });
    }

    const inserted = await pool.query(
      `
      INSERT INTO mwl_modality_targets
        (modality_code, pacs_id, orthanc_modality_name, manual_host, manual_port, manual_ae_title, manual_type, manual_protocol, manual_calling_ae, manual_called_ae, viewer_protocol, viewer_base_url, is_active, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      RETURNING *
      `,
      [
        modalityCode,
        pacs_id ? Number(pacs_id) : null,
        orthanc_modality_name || null,
        manual_host || null,
        manual_port ? Number(manual_port) : null,
        manual_ae_title || null,
        manual_type || null,
        manual_protocol || null,
        manual_calling_ae || null,
        manual_called_ae || null,
        viewer_protocol || null,
        viewer_base_url || null,
        Boolean(is_active),
      ]
    );
    await syncLocalDimseScpState();
    return res.json({ success: true, data: inserted.rows[0] });
  } catch (err) {
    console.error("MWL target save error:", err.message);
    return res.status(500).json({ success: false, error: "Failed to save MWL target" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await ensureMwlTargetsTable();
    const raw = String(req.params.id || "").trim();
    const isNumeric = /^\d+$/.test(raw);
    const deleted = isNumeric
      ? await pool.query("DELETE FROM mwl_modality_targets WHERE id = $1 RETURNING id", [Number(raw)])
      : await pool.query(
          "DELETE FROM mwl_modality_targets WHERE UPPER(modality_code) = UPPER($1) RETURNING id",
          [raw.toUpperCase()]
        );
    if (!deleted.rows.length) {
      return res.status(404).json({ success: false, error: "Mapping not found" });
    }
    await syncLocalDimseScpState();
    return res.json({ success: true });
  } catch (err) {
    console.error("MWL target delete error:", err.message);
    return res.status(500).json({ success: false, error: "Failed to delete MWL target" });
  }
});

module.exports = router;
module.exports.syncLocalDimseScpState = syncLocalDimseScpState;
