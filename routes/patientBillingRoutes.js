function createPatientBillingRoutes({ pool, queries, sendJSON }) {
  function getPatientBilling(req, patientId, res) {
    pool.query(queries.getPatientBilling, [patientId], (err, results) => {
      if (err) {
        console.error('Error fetching billing:', err);
        return sendJSON(res, 500, { error: 'Database error' });
      }
      if (results.length === 0) {
        return sendJSON(res, 404, { error: 'No billing data found' });
      }
      sendJSON(res, 200, results[0]);
    });
  }

  function getPatientInvoices(req, patientId, res) {
    pool.query(queries.getPatientInvoices, [patientId], (err, results) => {
      if (err) {
        console.error('Error fetching patient invoices:', err);
        return sendJSON(res, 500, { error: 'Database error' });
      }
      sendJSON(res, 200, results || []);
    });
  }

  function getPatientInvoiceById(req, patientId, invoiceId, res) {
    pool.query(queries.getPatientInvoiceById, [patientId, invoiceId], (invoiceErr, invoiceResults) => {
      if (invoiceErr) {
        console.error('Error fetching invoice details:', invoiceErr);
        return sendJSON(res, 500, { error: 'Database error' });
      }

      if (!invoiceResults.length) {
        return sendJSON(res, 404, { error: 'Invoice not found' });
      }

      pool.query(queries.getInvoicePayments, [invoiceId], (paymentsErr, paymentResults) => {
        if (paymentsErr) {
          console.error('Error fetching invoice payments:', paymentsErr);
          return sendJSON(res, 500, { error: 'Database error' });
        }

        sendJSON(res, 200, {
          invoice: invoiceResults[0],
          payments: paymentResults || []
        });
      });
    });
  }

  function getPaymentMethods(req, res) {
    pool.query(queries.getActivePaymentMethods, (err, results) => {
      if (err) {
        console.error('Error fetching payment methods:', err);
        return sendJSON(res, 500, { error: 'Database error' });
      }

      sendJSON(res, 200, results || []);
    });
  }

  function createPatientInvoicePayment(req, patientId, invoiceId, data, res) {
    const paymentAmount = Number(data?.paymentAmount);
    const methodId = Number(data?.methodId);
    const referenceNumber = data?.referenceNumber ? String(data.referenceNumber).trim() : null;
    const notes = data?.notes ? String(data.notes).trim() : null;

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return sendJSON(res, 400, { error: 'Payment amount must be greater than 0.' });
    }

    if (!Number.isInteger(methodId) || methodId <= 0) {
      return sendJSON(res, 400, { error: 'A valid payment method is required.' });
    }

    pool.getConnection((connectionErr, connection) => {
      if (connectionErr) {
        console.error('Error getting database connection:', connectionErr);
        return sendJSON(res, 500, { error: 'Database error' });
      }

      connection.beginTransaction((txErr) => {
        if (txErr) {
          connection.release();
          console.error('Error starting payment transaction:', txErr);
          return sendJSON(res, 500, { error: 'Database error' });
        }

        connection.query(queries.getPatientInvoiceForPayment, [patientId, invoiceId], (invoiceErr, invoiceRows) => {
          if (invoiceErr) {
            return connection.rollback(() => {
              connection.release();
              console.error('Error validating invoice payment:', invoiceErr);
              sendJSON(res, 500, { error: 'Database error' });
            });
          }

          if (!invoiceRows.length) {
            return connection.rollback(() => {
              connection.release();
              sendJSON(res, 404, { error: 'Invoice not found' });
            });
          }

          const invoiceRow = invoiceRows[0];
          const patientAmount = Number(invoiceRow.patient_amount || 0);
          const amountPaid = Number(invoiceRow.amount_paid || 0);
          const amountDue = Math.max(patientAmount - amountPaid, 0);

          if (amountDue <= 0) {
            return connection.rollback(() => {
              connection.release();
              sendJSON(res, 400, { error: 'This invoice is already fully paid.' });
            });
          }

          if (paymentAmount > amountDue) {
            return connection.rollback(() => {
              connection.release();
              sendJSON(res, 400, {
                error: `Payment exceeds the remaining balance of ${amountDue.toFixed(2)}.`
              });
            });
          }

          connection.query(queries.getActivePaymentMethodById, [methodId], (methodErr, methodRows) => {
            if (methodErr) {
              return connection.rollback(() => {
                connection.release();
                console.error('Error validating payment method:', methodErr);
                sendJSON(res, 500, { error: 'Database error' });
              });
            }

            if (!methodRows.length) {
              return connection.rollback(() => {
                connection.release();
                sendJSON(res, 400, { error: 'Selected payment method is not available.' });
              });
            }

            connection.query(
              queries.createPayment,
              [invoiceId, paymentAmount, new Date(), methodId, referenceNumber, notes],
              (createErr) => {
                if (createErr) {
                  return connection.rollback(() => {
                    connection.release();
                    console.error('Error creating payment:', createErr);
                    sendJSON(res, 500, { error: 'Database error' });
                  });
                }

                connection.query(queries.getPatientInvoiceById, [patientId, invoiceId], (invoiceDetailsErr, invoiceDetailsRows) => {
                  if (invoiceDetailsErr) {
                    return connection.rollback(() => {
                      connection.release();
                      console.error('Error reloading invoice details:', invoiceDetailsErr);
                      sendJSON(res, 500, { error: 'Database error' });
                    });
                  }

                  connection.query(queries.getInvoicePayments, [invoiceId], (paymentsErr, paymentRows) => {
                    if (paymentsErr) {
                      return connection.rollback(() => {
                        connection.release();
                        console.error('Error reloading payment history:', paymentsErr);
                        sendJSON(res, 500, { error: 'Database error' });
                      });
                    }

                    connection.commit((commitErr) => {
                      if (commitErr) {
                        return connection.rollback(() => {
                          connection.release();
                          console.error('Error committing payment transaction:', commitErr);
                          sendJSON(res, 500, { error: 'Database error' });
                        });
                      }

                      connection.release();
                      sendJSON(res, 201, {
                        message: 'Payment recorded successfully.',
                        invoice: invoiceDetailsRows?.[0] || null,
                        payments: paymentRows || []
                      });
                    });
                  });
                });
              }
            );
          });
        });
      });
    });
  }

  function handlePatientBillingRoutes(req, res, method, parts, parseJSON) {
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'patients' && parts[2] && parts[3] === 'billing') {
      const patientId = parseInt(parts[2], 10);
      getPatientBilling(req, patientId, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'patients' && parts[2] && parts[3] === 'invoices' && parts[4] && !parts[5]) {
      const patientId = parseInt(parts[2], 10);
      const invoiceId = parseInt(parts[4], 10);
      getPatientInvoiceById(req, patientId, invoiceId, res);
      return true;
    }

    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'patients' && parts[2] && parts[3] === 'invoices' && parts[4] && parts[5] === 'payments') {
      const patientId = parseInt(parts[2], 10);
      const invoiceId = parseInt(parts[4], 10);
      parseJSON(req, (err, data) => {
        if (err) {
          return sendJSON(res, 400, { error: 'Invalid JSON' });
        }
        return createPatientInvoicePayment(req, patientId, invoiceId, data, res);
      });
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'patients' && parts[2] && parts[3] === 'invoices') {
      const patientId = parseInt(parts[2], 10);
      getPatientInvoices(req, patientId, res);
      return true;
    }

    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'payment-methods') {
      getPaymentMethods(req, res);
      return true;
    }

    return false;
  }

  return {
    handlePatientBillingRoutes
  };
}

module.exports = {
  createPatientBillingRoutes
};
