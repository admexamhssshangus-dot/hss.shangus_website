import React, { useState } from 'react';

export default function StudentRegistrationPage() {
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [formNumber, setFormNumber] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('http://localhost:4000/api/students/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationNumber, formNumber, mode: 'student' })
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ ok: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'Arial' }}>
      <h2>Student Registration</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Registration Number</label>
          <input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Form Number</label>
          <input value={formNumber} onChange={(e) => setFormNumber(e.target.value)} style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }} />
        </div>
        <button type="submit" disabled={loading} style={{ padding: '10px 16px' }}>
          {loading ? 'Submitting...' : 'Submit'}
        </button>
      </form>

      {result && (
        <div style={{ marginTop: 24, padding: 16, border: '1px solid #ddd' }}>
          <h3>Result</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
