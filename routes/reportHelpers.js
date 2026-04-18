function createReportHelpers({ pool }) {
  function normalizeDateParam(value) {
    const raw = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
  }

  function normalizeOptionalFilter(value) {
    return String(value || '').trim();
  }

  function createReportFiltersFromQuery(query) {
    const fromDate = normalizeDateParam(query.fromDate);
    const toDate = normalizeDateParam(query.toDate);
    const procedureCode = normalizeOptionalFilter(query.procedureCode).toUpperCase();
    const toothNumber = normalizeOptionalFilter(query.toothNumber);
    const surface = normalizeOptionalFilter(query.surface).toUpperCase();

    if (!fromDate || !toDate) {
      return { error: 'fromDate and toDate are required in YYYY-MM-DD format' };
    }
    if (new Date(`${fromDate}T00:00:00`).getTime() > new Date(`${toDate}T00:00:00`).getTime()) {
      return { error: 'fromDate must be before or equal to toDate' };
    }

    return { fromDate, toDate, procedureCode, toothNumber, surface };
  }

  function fetchTreatmentRowsForReport({ patientId = null, fromDate, toDate, procedureCode, toothNumber, surface }, callback) {
    const includeAllPatients = !Number.isInteger(patientId) || patientId <= 0;
    pool.query(
      `SELECT
        tp.plan_id AS treatment_id,
        tp.patient_id,
        CONCAT(p.p_first_name, ' ', p.p_last_name) AS patient_name,
        tp.start_date AS visit_date,
        tp.procedure_code,
        apc.description AS treatment_description,
        tp.tooth_number,
        tp.surface,
        tp.estimated_cost AS treatment_cost,
        tp.notes,
        tp.created_at
      FROM treatment_plans tp
      JOIN patients p ON p.patient_id = tp.patient_id
      LEFT JOIN ada_procedure_codes apc ON apc.procedure_code = tp.procedure_code
      WHERE (? = TRUE OR tp.patient_id = ?)
        AND tp.start_date BETWEEN ? AND ?
        AND (? = '' OR tp.procedure_code = ?)
        AND (? = '' OR tp.tooth_number = ?)
        AND (? = '' OR UPPER(COALESCE(tp.surface, '')) = ?)
      ORDER BY tp.start_date DESC, tp.created_at DESC, tp.plan_id DESC`,
      [includeAllPatients, patientId || 0, fromDate, toDate, procedureCode, procedureCode, toothNumber, toothNumber, surface, surface],
      (err, rows) => callback(err, rows || [])
    );
  }

  function fetchFindingRowsForReport({ patientId = null, fromDate, toDate, toothNumber, surface }, callback) {
    const includeAllPatients = !Number.isInteger(patientId) || patientId <= 0;
    pool.query(
      `SELECT
        df.patient_id,
        COALESCE(a.appointment_date, DATE(df.date_logged)) AS visit_date,
        GROUP_CONCAT(
          CONCAT(
            'Tooth ', COALESCE(df.tooth_number, 'N/A'),
            CASE WHEN COALESCE(df.surface, '') <> '' THEN CONCAT(' (', df.surface, ')') ELSE '' END,
            ': ', COALESCE(df.condition_type, 'Finding'),
            CASE WHEN COALESCE(df.notes, '') <> '' THEN CONCAT(' - ', df.notes) ELSE '' END
          )
          ORDER BY df.finding_id ASC SEPARATOR ' | '
        ) AS finding_summary
      FROM dental_findings df
      LEFT JOIN appointments a ON a.appointment_id = df.appointment_id
      WHERE (? = TRUE OR df.patient_id = ?)
        AND COALESCE(a.appointment_date, DATE(df.date_logged)) BETWEEN ? AND ?
        AND (? = '' OR df.tooth_number = ?)
        AND (? = '' OR UPPER(COALESCE(df.surface, '')) = ?)
      GROUP BY df.patient_id, COALESCE(a.appointment_date, DATE(df.date_logged))
      ORDER BY visit_date DESC`,
      [includeAllPatients, patientId || 0, fromDate, toDate, toothNumber, toothNumber, surface, surface],
      (err, rows) => callback(err, rows || [])
    );
  }

  function buildGroupedReport(treatmentRows, findingRows) {
    const findingMap = new Map();
    findingRows.forEach((item) => {
      const dateKey = (item.visit_date instanceof Date ? item.visit_date.toISOString().slice(0, 10) : String(item.visit_date || '').slice(0, 10)) || 'Unknown date';
      const key = `${Number(item.patient_id || 0)}::${dateKey}`;
      findingMap.set(key, String(item.finding_summary || ''));
    });

    const grouped = new Map();

    treatmentRows.forEach((row) => {
      const dateKey = (row.visit_date instanceof Date ? row.visit_date.toISOString().slice(0, 10) : String(row.visit_date || '').slice(0, 10)) || 'Unknown date';
      const patientId = Number(row.patient_id || 0);
      const patientName = String(row.patient_name || 'Unknown patient');
      const groupKey = `${patientId}::${dateKey}`;

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, { patientId, patientName, visitDate: dateKey, visitCost: 0, entries: [] });
      }

      const bucket = grouped.get(groupKey);
      const numericCost = Number(row.treatment_cost);
      if (Number.isFinite(numericCost) && numericCost > 0) {
        bucket.visitCost += numericCost;
      }

      bucket.entries.push({
        treatmentId: row.treatment_id,
        procedureCode: row.procedure_code,
        treatmentDescription: row.treatment_description,
        toothNumber: row.tooth_number,
        surface: row.surface,
        cost: Number.isFinite(numericCost) ? numericCost : 0,
        finding: findingMap.get(groupKey) || '',
        notes: row.notes,
        createdAt: row.created_at
      });
    });

    return Array.from(grouped.values()).sort((a, b) => {
      const dateCompare = String(b.visitDate).localeCompare(String(a.visitDate));
      if (dateCompare !== 0) return dateCompare;
      return a.patientName.localeCompare(b.patientName);
    });
  }

  return { createReportFiltersFromQuery, fetchTreatmentRowsForReport, fetchFindingRowsForReport, buildGroupedReport };
}

module.exports = { createReportHelpers };
