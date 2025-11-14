export async function readExistingEventsData(octokit) {

    const { data: currentFile } = await octokit.repos.getContent({
        owner: "derberg",
        repo: "zatyrani.pl",
        path: "src/data/events.json",
    });

    let events = [];
    if (currentFile && currentFile.content) {
        const decoded = Buffer.from(currentFile.content, "base64").toString();
        events = JSON.parse(decoded);
    }

    return events;
}

export async function updateEventsFile(octokit, message, content) {
    await octokit.createOrUpdateTextFile({
        owner: "derberg",
        repo: "zatyrani.pl",
        path: "src/data/events.json",
        message,
        content: JSON.stringify(content, null, 2),
    });
}

export function formatDate(dateString) {
  const date = new Date(dateString);

  const day = String(date.getDate()).padStart(2, "0"); // Ensures two digits
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

// Format DD/MM/YYYY to localized Polish date display
export function formatDateDisplay(dateString) {
  const [day, month, year] = dateString.split('/').map(Number);
  const dateObj = new Date(year, month - 1, day);
  
  return new Intl.DateTimeFormat('pl-PL', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  }).format(dateObj);
}

// Format DD/MM/YYYY HH:MM to localized Polish datetime display
export function formatDateTimeDisplay(dateTimeString) {
  const [datePart, timePart] = dateTimeString.split(' ');
  const [day, month, year] = datePart.split('/').map(Number);
  const [hours, minutes] = timePart.split(':');
  
  const dateObj = new Date(year, month - 1, day, hours, minutes);
  return new Intl.DateTimeFormat('pl-PL', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(dateObj);
}

// Format DD/MM/YYYY to YYYY-MM-DD for HTML input
export function formatDateForInput(dateString) {
  if (!dateString) return "";
  const [day, month, year] = dateString.split("/");
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Format DD/MM/YYYY HH:MM to YYYY-MM-DDTHH:MM for HTML datetime-local input
export function formatDateTimeForInput(dateTimeString) {
  if (!dateTimeString) return "";
  const [datePart, timePart] = dateTimeString.split(" ");
  const [day, month, year] = datePart.split("/");
  const [hours, minutes] = timePart.split(":");
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
}




