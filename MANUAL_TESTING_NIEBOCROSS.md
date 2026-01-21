# 🧪 Plan Testów Manualnych - System Rejestracji NieboCross

## 📋 Lista kontrolna testów do przeprowadzenia przed publikacją

---

## 1. Feature Flag (Flaga funkcjonalności)

### Test 1.1: Strona dla nie zarejestrowanego
- [ ] Odwiedź `/niebocross`
- [ ] **Oczekiwany rezultat:** Widoczne przyciski:
  - "Zapisz się teraz" → prowadzi do `/niebocross/rejestracja`
  - "Zaloguj się" → prowadzi do `/niebocross/zaloguj`
  - "Lista uczestników" → prowadzi do `/niebocross/lista`
---

## 2. Proces Rejestracji

### Test 2.1: Rozpoczęcie rejestracji (Krok 1 - Email)
- [ ] Przejdź na `/niebocross/rejestracja`
- [ ] Wpisz prawidłowy adres email
- [ ] Wpisz imię i nazwisko osoby kontaktowej
- [ ] Zaznacz zgodę RODO
- [ ] Kliknij "Wyślij kod weryfikacyjny"
- [ ] **Oczekiwany rezultat:** Email z 6-cyfrowym kodem dotarł na skrzynkę
- [ ] **Oczekiwany rezultat:** Przejście do kroku 2 (weryfikacja kodu)

### Test 2.2: Walidacja emaila (Krok 1)
- [ ] Spróbuj wysłać formularz bez emaila
- [ ] **Oczekiwany rezultat:** Walidacja HTML5 - wymagane pole
- [ ] Spróbuj wysłać formularz bez zgody RODO
- [ ] **Oczekiwany rezultat:** Walidacja HTML5 - wymagane pole
- [ ] Spróbuj użyć emaila, który już istnieje w bazie
- [ ] **Oczekiwany rezultat:** Komunikat błędu: "Ten email jest już zarejestrowany. Jeśli to Ty, zaloguj się używając linku w emailu."

### Test 2.3: Rate limiting emaili
- [ ] Spróbuj wysłać kod więcej niż 3 razy w ciągu godziny dla tego samego emaila
- [ ] **Oczekiwany rezultat:** Komunikat: "Zbyt wiele prób. Spróbuj ponownie za godzinę."

### Test 2.4: Weryfikacja kodu (Krok 2)
- [ ] Wpisz otrzymany 6-cyfrowy kod
- [ ] Kliknij "Zweryfikuj kod"
- [ ] **Oczekiwany rezultat:** Kod zaakceptowany, sesja utworzona (ciasteczko ustawione)
- [ ] **Oczekiwany rezultat:** Przejście do kroku 3 (dodawanie uczestników)

### Test 2.5: Nieprawidłowy kod
- [ ] Wpisz nieprawidłowy kod (np. 000000)
- [ ] **Oczekiwany rezultat:** Komunikat błędu: "Nieprawidłowy lub wygasły kod"

### Test 2.6: Wygasły kod
- [ ] Poczekaj 10 minut po otrzymaniu kodu
- [ ] Spróbuj użyć kodu
- [ ] **Oczekiwany rezultat:** Komunikat błędu: "Kod wygasł"

### Test 2.7: Dodawanie uczestnika (Krok 3)
- [ ] Automatycznie dodany pierwszy formularz uczestnika
- [ ] Wypełnij wszystkie wymagane pola:
  - Imię i nazwisko
  - Data urodzenia
  - Miejscowość
  - Narodowość
  - Kategoria biegu (wybierz 3km - Bieg)
- [ ] Zaznacz akceptację regulaminu
- [ ] **Oczekiwany rezultat:** Podsumowanie po prawej stronie aktualizuje się automatycznie
- [ ] **Oczekiwany rezultat:** "Opłaty startowe: 60 zł"

### Test 2.8: Walidacja wieku - Dorośli
- [ ] Dodaj uczestnika z datą urodzenia: 10.04.2010 (będzie miał 16 lat w dniu wydarzenia)
- [ ] Wybierz kategorię 3km - Bieg
- [ ] **Oczekiwany rezultat:** Formularz przechodzi walidację
- [ ] Dodaj uczestnika z datą urodzenia: 13.04.2010 (będzie miał 15 lat)
- [ ] Wybierz kategorię 3km - Bieg
- [ ] **Oczekiwany rezultat:** Błąd: "Minimalny wiek dla tras 3km i 9km to 16 lat"

### Test 2.9: Walidacja wieku - Dzieci
- [ ] Dodaj uczestnika z datą urodzenia: 13.04.2011 (będzie miał 14 lat)
- [ ] Wybierz kategorię Dzieci - 100m
- [ ] **Oczekiwany rezultat:** Formularz przechodzi walidację
- [ ] Dodaj uczestnika z datą urodzenia: 10.04.2011 (będzie miał 15 lat)
- [ ] Wybierz kategorię Dzieci - 100m
- [ ] **Oczekiwany rezultat:** Błąd: "Biegi dzieci dla uczestników do 14 lat"

### Test 2.10: Kalkulator płatności - Bieg dorosłych
- [ ] Dodaj uczestnika, wybierz 3km - Bieg, bez koszulki
- [ ] **Oczekiwany rezultat:** 
  - Opłaty startowe: 60 zł
  - Koszulki: 0 zł
  - Razem: 60 zł
  - Na cel charytatywny: 60.00 zł

### Test 2.11: Kalkulator płatności - Bieg dzieci
- [ ] Dodaj dziecko, wybierz Dzieci - 100m, bez koszulki
- [ ] **Oczekiwany rezultat:**
  - Opłaty startowe: 20 zł
  - Koszulki: 0 zł
  - Razem: 20 zł
  - Na cel charytatywny: 20.00 zł

### Test 2.12: Kalkulator płatności - Z koszulką
- [ ] Dodaj uczestnika, wybierz 9km - Bieg, koszulka rozmiar M
- [ ] **Oczekiwany rezultat:**
  - Opłaty startowe: 60 zł
  - Koszulki: 80 zł
  - Razem: 140 zł
  - Na cel charytatywny: 70.00 zł (60 + (80 * 10/80))

### Test 2.13: Wielu uczestników
- [ ] Kliknij "+ Dodaj uczestnika"
- [ ] Wypełnij dane drugiego uczestnika
- [ ] **Oczekiwany rezultat:** Nowy formularz pojawia się poniżej
- [ ] **Oczekiwany rezultat:** Przycisk "Usuń" widoczny tylko dla 2. i kolejnych uczestników
- [ ] **Oczekiwany rezultat:** Podsumowanie aktualizuje sumę za wszystkich uczestników

### Test 2.14: Usuwanie uczestnika
- [ ] Dodaj 3 uczestników
- [ ] Kliknij "Usuń" przy 2. uczestniku
- [ ] **Oczekiwany rezultat:** Uczestnik usunięty z formularza
- [ ] **Oczekiwany rezultat:** Podsumowanie zaktualizowane

### Test 2.15: Klub - Autouzupełnianie
- [ ] Zacznij wpisywać nazwę klubu (np. "Zatyrani")
- [ ] **Oczekiwany rezultat:** Pole tekstowe (nie autouzupełnianie w tej wersji)
- [ ] Wpisz pełną nazwę klubu ręcznie

### Test 2.16: Ukryj nazwisko na liście publicznej
- [ ] Zaznacz checkbox "Ukryj moje nazwisko na publicznej liście uczestników"
- [ ] **Oczekiwany rezultat:** Checkbox zaznaczony

### Test 2.17: Przejście do płatności (Krok 4)
- [ ] Wypełnij dane przynajmniej 1 uczestnika poprawnie
- [ ] Kliknij "Przejdź do płatności"
- [ ] **Oczekiwany rezultat:** Email z potwierdzeniem i linkiem do płatności
- [ ] **Oczekiwany rezultat:** Przejście do kroku 4 z linkiem do płatności
- [ ] **Oczekiwany rezultat:** Przycisk "Opłać teraz"
- [ ] **Oczekiwany rezultat:** Link do panelu uczestnika

---

## 3. Logowanie (dla powracających użytkowników)

### Test 3.1: Logowanie - Wysłanie kodu
- [ ] Przejdź na `/niebocross/zaloguj`
- [ ] Wpisz email używany podczas rejestracji
- [ ] Kliknij "Wyślij kod weryfikacyjny"
- [ ] **Oczekiwany rezultat:** Email z nowym kodem weryfikacyjnym
- [ ] **Oczekiwany rezultat:** Przejście do formularza weryfikacji kodu

### Test 3.2: Logowanie - Niepoprawny email
- [ ] Wpisz email, który nie istnieje w bazie
- [ ] **Oczekiwany rezultat:** Komunikat błędu: "Email nie znaleziony w rejestracji"

### Test 3.3: Weryfikacja i przekierowanie
- [ ] Wpisz otrzymany kod
- [ ] Kliknij "Zweryfikuj kod"
- [ ] **Oczekiwany rezultat:** Automatyczne przekierowanie do `/niebocross/panel`

### Test 3.4: Przekierowanie jeśli zalogowany
- [ ] Będąc zalogowanym, przejdź na `/niebocross/rejestracja`
- [ ] **Oczekiwany rezultat:** Automatyczne przekierowanie do `/niebocross/panel`
- [ ] Przejdź na `/niebocross/zaloguj`
- [ ] **Oczekiwany rezultat:** Automatyczne przekierowanie do `/niebocross/panel`

---

## 4. Panel Uczestnika

### Test 4.1: Dostęp do panelu
- [ ] Będąc zalogowanym, przejdź na `/niebocross/panel`
- [ ] **Oczekiwany rezultat:** Widoczny email zarejestrowanego użytkownika
- [ ] **Oczekiwany rezultat:** Status płatności (Oczekuje na płatność / Opłacone)
- [ ] **Oczekiwany rezultat:** Lista wszystkich uczestników

### Test 4.2: Panel - Nieopłacona rejestracja
- [ ] Sprawdź panel przed opłaceniem
- [ ] **Oczekiwany rezultat:** Status: "Oczekuje na płatność"
- [ ] **Oczekiwany rezultat:** Przycisk "Opłać teraz" widoczny
- [ ] **Oczekiwany rezultat:** Przyciski "Edytuj" i "Usuń" widoczne przy każdym uczestniku
- [ ] **Oczekiwany rezultat:** Przycisk "+ Dodaj uczestnika" widoczny

### Test 4.3: Edycja uczestnika
- [ ] Kliknij "Edytuj" przy wybranym uczestniku
- [ ] **Oczekiwany rezultat:** Modal z formularzem edycji, wypełniony aktualnymi danymi
- [ ] Zmień np. rozmiar koszulki z "bez koszulki" na "M"
- [ ] Kliknij "Zapisz zmiany"
- [ ] **Oczekiwany rezultat:** Modal zamyka się
- [ ] **Oczekiwany rezultat:** Dane uczestnika zaktualizowane
- [ ] **Oczekiwany rezultat:** Status płatności pokazuje nową kwotę (+80 zł)

### Test 4.4: Walidacja podczas edycji
- [ ] Otwórz edycję uczestnika dorosłego
- [ ] Zmień kategorię na "Dzieci - 100m" (zostawiając datę urodzenia osoby dorosłej)
- [ ] Spróbuj zapisać
- [ ] **Oczekiwany rezultat:** Komunikat błędu walidacji wieku

### Test 4.5: Usuwanie uczestnika
- [ ] Jeśli masz więcej niż 1 uczestnika, kliknij "Usuń" przy jednym
- [ ] **Oczekiwany rezultat:** Potwierdzenie "Czy na pewno chcesz usunąć tego uczestnika?"
- [ ] Potwierdź usunięcie
- [ ] **Oczekiwany rezultat:** Uczestnik usunięty
- [ ] **Oczekiwany rezultat:** Kwota płatności zaktualizowana

### Test 4.6: Usunięcie ostatniego uczestnika
- [ ] Jeśli masz tylko 1 uczestnika, usuń go
- [ ] **Oczekiwany rezultat:** Uczestnik usunięty
- [ ] **Oczekiwany rezultat:** Status płatności: "Brak zarejestrowanych uczestników"
- [ ] **Oczekiwany rezultat:** Rekord płatności usunięty z bazy

### Test 4.7: Wylogowanie
- [ ] Kliknij przycisk "Wyloguj"
- [ ] **Oczekiwany rezultat:** Przekierowanie do `/niebocross`
- [ ] **Oczekiwany rezultat:** Ciasteczko sesji usunięte
- [ ] Spróbuj ponownie wejść na `/niebocross/panel`
- [ ] **Oczekiwany rezultat:** Przekierowanie do `/niebocross/zaloguj`

---

## 5. Panel po Opłaceniu

### Test 5.1: Symulacja płatności
**Uwaga:** Do tego testu potrzebny webhook od SIBS lub ręczna zmiana statusu w bazie danych.

- [ ] W bazie danych zmień `payment_status` na 'paid' dla testowej rejestracji
- [ ] Ustaw `paid_at` na aktualny timestamp
- [ ] Odśwież panel

### Test 5.2: Panel - Opłacona rejestracja
- [ ] **Oczekiwany rezultat:** Status: "Opłacone" (zielone tło)
- [ ] **Oczekiwany rezultat:** Ikona checkmark ✓
- [ ] **Oczekiwany rezultat:** BRAK przycisku "Opłać teraz"
- [ ] **Oczekiwany rezultat:** BRAK przycisków "Edytuj" i "Usuń"
- [ ] **Oczekiwany rezultat:** BRAK przycisku "+ Dodaj uczestnika"

### Test 5.3: Blokada edycji po opłaceniu
- [ ] Spróbuj wywołać bezpośrednio API `/api/niebocross/update-participant`
- [ ] **Oczekiwany rezultat:** HTTP 403 z komunikatem: "Nie można edytować uczestnika po opłaceniu rejestracji. Skontaktuj się z organizatorem: https://zatyrani.pl/niebocross#kontakt"

### Test 5.4: Blokada usuwania po opłaceniu
- [ ] Spróbuj wywołać bezpośrednio API `/api/niebocross/delete-participant`
- [ ] **Oczekiwany rezultat:** HTTP 403 z komunikatem: "Nie można usunąć uczestnika po opłaceniu rejestracji..."

---

## 6. Blokada po Dacie Wydarzenia

### Test 6.1: Zmiana daty systemowej
**Uwaga:** Test do wykonania 13 kwietnia 2026 lub później, lub przez zmianę daty systemowej.

- [ ] Ustaw datę systemową na 13.04.2026 (dzień po wydarzeniu)
- [ ] Zaloguj się do panelu z nieopłaconą rejestracją

### Test 6.2: Panel po dacie wydarzenia
- [ ] **Oczekiwany rezultat:** BRAK przycisków "Edytuj" i "Usuń"
- [ ] **Oczekiwany rezultat:** BRAK przycisku "+ Dodaj uczestnika"
- [ ] **Oczekiwany rezultat:** Status pokazuje, że edycja jest niemożliwa

### Test 6.3: Blokada API po dacie
- [ ] Spróbuj wywołać API edycji lub usuwania
- [ ] **Oczekiwany rezultat:** HTTP 403 z komunikatem o dacie wydarzenia

---

## 7. Publiczna Lista Uczestników

### Test 7.1: Dostęp do listy
- [ ] Przejdź na `/niebocross/lista` (bez logowania)
- [ ] **Oczekiwany rezultat:** Tabela z uczestnikami, którzy opłacili udział
- [ ] **Oczekiwany rezultat:** Kolumny: Imię i nazwisko, Data urodzenia, Miejscowość, Narodowość, Klub, Kategoria biegu

### Test 7.2: Tylko opłaceni uczestnicy
- [ ] Sprawdź czy lista zawiera tylko uczestników ze statusem 'paid'
- [ ] **Oczekiwany rezultat:** Uczestnicy z statusem 'pending' NIE są widoczni

### Test 7.3: Ukryte nazwiska
- [ ] Znajdź uczestnika, który zaznaczył "Ukryj nazwisko"
- [ ] **Oczekiwany rezultat:** Zamiast nazwiska wyświetlone "***"

### Test 7.4: Filtr - Kategoria biegu
- [ ] Wybierz z listy "9km - Bieg"
- [ ] Kliknij "Zastosuj filtry"
- [ ] **Oczekiwany rezultat:** Lista pokazuje tylko uczestników biegu 9km

### Test 7.5: Filtr - Miejscowość
- [ ] Wpisz nazwę miejscowości (np. "Gliwice")
- [ ] Kliknij "Zastosuj filtry"
- [ ] **Oczekiwany rezultat:** Lista pokazuje tylko uczestników z Gliwic

### Test 7.6: Filtr - Klub
- [ ] Wpisz nazwę klubu (np. "Zatyrani")
- [ ] Kliknij "Zastosuj filtry"
- [ ] **Oczekiwany rezultat:** Lista pokazuje tylko członków klubu Zatyrani

### Test 7.7: Filtr - Narodowość
- [ ] Wpisz narodowość (np. "Polska")
- [ ] Kliknij "Zastosuj filtry"
- [ ] **Oczekiwany rezultat:** Lista pokazuje tylko Polaków

### Test 7.8: Kombinacja filtrów
- [ ] Wybierz kategorię "3km - Bieg"
- [ ] Wpisz miejscowość "Gliwice"
- [ ] Kliknij "Zastosuj filtry"
- [ ] **Oczekiwany rezultat:** Lista pokazuje tylko uczestników 3km z Gliwic

### Test 7.9: Wyczyszczenie filtrów
- [ ] Po zastosowaniu filtrów, kliknij "Wyczyść filtry"
- [ ] **Oczekiwany rezultat:** Wszystkie pola filtrów wyczyszczone
- [ ] **Oczekiwany rezultat:** Lista pokazuje wszystkich uczestników

### Test 7.10: Licznik uczestników
- [ ] Sprawdź wartość "Łącznie uczestników: X"
- [ ] **Oczekiwany rezultat:** Liczba odpowiada liczbie wierszy w tabeli

### Test 7.11: Brak wyników
- [ ] Ustaw filtr na nieistniejącą kombinację (np. kategoria dzieci + klub zawodowy)
- [ ] **Oczekiwany rezultat:** Komunikat "Brak uczestników spełniających kryteria wyszukiwania"

---

## 8. Sekcja Kontakt

### Test 8.1: Sekcja na stronie głównej
- [ ] Przewiń stronę `/niebocross` do sekcji #kontakt
- [ ] **Oczekiwany rezultat:** Nagłówek "Masz pytania? Skontaktuj się z nami"
- [ ] **Oczekiwany rezultat:** Przycisk "biuro@zatyrani.pl" (link mailto:)
- [ ] **Oczekiwany rezultat:** Przycisk "784 640 977" (link tel:)

### Test 8.2: Linki w komunikatach błędów
- [ ] Spróbuj edytować uczestnika po opłaceniu (symulacja)
- [ ] **Oczekiwany rezultat:** Link w komunikacie błędu prowadzi do `/niebocross#kontakt`

---

## 9. Emaile

### Test 9.1: Email weryfikacyjny (Rejestracja)
- [ ] Rozpocznij nową rejestrację
- [ ] **Oczekiwany rezultat:** Email z tematem zawierającym "NieboCross"
- [ ] **Oczekiwany rezultat:** 6-cyfrowy kod weryfikacyjny widoczny w treści
- [ ] **Oczekiwany rezultat:** Email zawiera HTML i wersję tekstową

### Test 9.2: Email weryfikacyjny (Logowanie)
- [ ] Zaloguj się jako powracający użytkownik
- [ ] **Oczekiwany rezultat:** Email z nowym kodem
- [ ] **Oczekiwany rezultat:** Kod działa

### Test 9.3: Email potwierdzenia rejestracji
- [ ] Zarejestruj uczestników i przejdź do kroku płatności
- [ ] **Oczekiwany rezultat:** Email z:
  - Listą uczestników
  - Kwotą do zapłaty
  - Kwotą na cel charytatywny
  - Linkiem do płatności
  - Linkiem do panelu

### Test 9.4: Email potwierdzenia płatności
**Uwaga:** Wymaga działającego webhooka płatności.

- [ ] Opłać rejestrację (lub symuluj webhook)
- [ ] **Oczekiwany rezultat:** Email z:
  - Potwierdzeniem płatności ✓
  - Kwotą zapłaconą
  - ID transakcji
  - Informacją o kwocie na cel charytatywny
  - Linkiem do panelu

---

## 10. Webhook Płatności (SIBS)

**Uwaga:** Testy webhooka wymagają konfiguracji SIBS Pay i testowego środowiska.

### Test 10.1: Webhook - Płatność udana
- [ ] Symuluj webhook z SIBS z statusem 'success'
- [ ] **Oczekiwany rezultat:** Status płatności zmieniony na 'paid'
- [ ] **Oczekiwany rezultat:** Pole `paid_at` ustawione
- [ ] **Oczekiwany rezultat:** Pole `transaction_id` zapisane
- [ ] **Oczekiwany rezultat:** Email potwierdzenia wysłany

### Test 10.2: Webhook - Płatność nieudana
- [ ] Symuluj webhook z statusem 'failed'
- [ ] **Oczekiwany rezultat:** Status płatności zmieniony na 'failed'
- [ ] **Oczekiwany rezultat:** Możliwość ponownej próby płatności
- [ ] **Oczekiwany rezultat:** BRAK emaila potwierdzenia

### Test 10.3: Webhook - Weryfikacja podpisu
- [ ] Wyślij webhook z nieprawidłowym podpisem
- [ ] **Oczekiwany rezultat:** HTTP 401 Unauthorized
- [ ] **Oczekiwany rezultat:** Płatność NIE została zaktualizowana

---

## 11. Rate Limiting

### Test 11.1: Limit kodów weryfikacyjnych
- [ ] Wyślij 3 kody weryfikacyjne dla tego samego emaila
- [ ] **Oczekiwany rezultat:** Wszystkie 3 się udają
- [ ] Wyślij 4. kod w ciągu godziny
- [ ] **Oczekiwany rezultat:** Błąd: "Zbyt wiele prób. Spróbuj ponownie za godzinę."

### Test 11.2: Reset limitu po godzinie
- [ ] Poczekaj 1 godzinę po 3. kodzie
- [ ] Spróbuj wysłać nowy kod
- [ ] **Oczekiwany rezultat:** Kod wysłany pomyślnie

---

## 12. Bezpieczeństwo

### Test 12.1: Próba dostępu bez sesji
- [ ] Wyloguj się
- [ ] Spróbuj wywołać `/api/niebocross/dashboard`
- [ ] **Oczekiwany rezultat:** HTTP 401 Unauthorized

### Test 12.2: Próba edycji cudzych danych
- [ ] Zaloguj się jako użytkownik A
- [ ] Spróbuj edytować uczestnika użytkownika B (zmień ID w request)
- [ ] **Oczekiwany rezultat:** HTTP 404 (uczestnik nie znaleziony dla tej rejestracji)

### Test 12.3: JWT - Token wygasły
- [ ] Użyj tokenu starszego niż 180 dni
- [ ] **Oczekiwany rezultat:** HTTP 401 z komunikatem o wygasłej sesji

### Test 12.4: SQL Injection (podstawowe)
- [ ] W polu email wpisz: `test'; DROP TABLE niebocross_registrations; --`
- [ ] **Oczekiwany rezultat:** Błąd walidacji emaila lub bezpieczne przetworzenie
- [ ] **Oczekiwany rezultat:** Tabela NIE została usunięta

---

## 13. Responsywność i UX

### Test 13.1: Mobile (viewport 375px)
- [ ] Otwórz stronę na telefonie lub w DevTools z viewport 375px
- [ ] Przejdź przez cały proces rejestracji
- [ ] **Oczekiwany rezultat:** Wszystkie elementy widoczne i funkcjonalne
- [ ] **Oczekiwany rezultat:** Brak poziomego przewijania

### Test 13.2: Tablet (viewport 768px)
- [ ] Otwórz na tablecie
- [ ] **Oczekiwany rezultat:** Layout dostosowany do szerokości
- [ ] **Oczekiwany rezultat:** Siatka formularzy działa poprawnie

### Test 13.3: Desktop (viewport 1920px)
- [ ] Otwórz na dużym ekranie
- [ ] **Oczekiwany rezultat:** Treść nie rozciąga się nadmiernie
- [ ] **Oczekiwany rezultat:** Max-width utrzymuje czytelność

---

## 14. Performance

### Test 14.1: Czas ładowania strony
- [ ] Zmierz czas ładowania `/niebocross`
- [ ] **Oczekiwany rezultat:** < 2 sekundy na dobrym połączeniu

### Test 14.2: Lista uczestników z dużą ilością danych
- [ ] Dodaj do bazy 100+ uczestników
- [ ] Załaduj `/niebocross/lista`
- [ ] **Oczekiwany rezultat:** Strona ładuje się płynnie
- [ ] **Oczekiwany rezultat:** Tabela czytelna i responsywna

---

## 15. Edge Cases

### Test 15.1: Brak połączenia z bazą danych
- [ ] Symuluj błąd połączenia z Supabase
- [ ] **Oczekiwany rezultat:** Komunikat błędu przyjazny użytkownikowi
- [ ] **Oczekiwany rezultat:** Aplikacja nie crashuje

### Test 15.2: SendGrid offline
- [ ] Symuluj błąd SendGrid (nieprawidłowy API key)
- [ ] Spróbuj wysłać kod weryfikacyjny
- [ ] **Oczekiwany rezultat:** Rejestracja kontynuuje (błąd emaila nie blokuje)

### Test 15.3: Bardzo długie dane w formularzach
- [ ] Wpisz bardzo długie imię (200+ znaków)
- [ ] **Oczekiwany rezultat:** Walidacja długości lub obcięcie

### Test 15.4: Znaki specjalne w danych
- [ ] Wpisz imię z polskimi znakami: Łukasz Zażółć
- [ ] **Oczekiwany rezultat:** Poprawnie zapisane i wyświetlone

---

## ✅ Podsumowanie

**Data przeprowadzenia testów:** _______________

**Tester:** _______________

**Wszystkie testy zaliczone:** ☐ TAK / ☐ NIE

**Znalezione problemy:**
_______________________________________
_______________________________________
_______________________________________

**System gotowy do produkcji:** ☐ TAK / ☐ NIE

**Uwagi:**
_______________________________________
_______________________________________
_______________________________________
