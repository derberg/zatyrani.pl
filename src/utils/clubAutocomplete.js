// Club autocomplete functionality shared between registration and panel components
let currentClubInput = null;
let debounceTimer = null;

export function setupClubAutocomplete() {
  document.querySelectorAll('.club-input').forEach(input => {
    const suggestionsContainer = input.parentElement.querySelector('.club-suggestions');

    input.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      currentClubInput = e.target;

      if (query.length < 2) {
        suggestionsContainer.classList.add('hidden');
        return;
      }

      // Debounce API calls
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchClubSuggestions(query, suggestionsContainer);
      }, 300);
    });

    input.addEventListener('focus', () => {
      if (input.value.trim().length >= 2) {
        fetchClubSuggestions(input.value.trim(), suggestionsContainer);
      }
    });

    input.addEventListener('blur', () => {
      // Delay hiding to allow click on suggestions
      setTimeout(() => {
        suggestionsContainer.classList.add('hidden');
      }, 150);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        suggestionsContainer.classList.add('hidden');
      }
    });
  });
}

export async function fetchClubSuggestions(query, container) {
  try {
    const response = await fetch(`/api/niebocross/clubs/search?q=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (data.success && data.clubs && data.clubs.length > 0) {
      showClubSuggestions(data.clubs, container);
    } else {
      container.classList.add('hidden');
    }
  } catch (error) {
    console.error('Error fetching club suggestions:', error);
    container.classList.add('hidden');
  }
}

export function showClubSuggestions(clubs, container) {
  container.innerHTML = '';

  clubs.forEach(club => {
    const suggestionItem = document.createElement('div');
    suggestionItem.className = 'px-3 py-2 hover:bg-emerald-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0';
    suggestionItem.textContent = club;
    suggestionItem.addEventListener('click', () => {
      if (currentClubInput) {
        currentClubInput.value = club;
        container.classList.add('hidden');
      }
    });
    container.appendChild(suggestionItem);
  });

  container.classList.remove('hidden');
}