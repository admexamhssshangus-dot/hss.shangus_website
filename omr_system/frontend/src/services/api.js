export async function registerStudent(payload) {
  const response = await fetch('http://localhost:4000/api/students/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return response.json();
}
