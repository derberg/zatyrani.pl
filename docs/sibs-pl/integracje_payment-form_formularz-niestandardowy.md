<!-- Source: https://www.docs.pay.sibs.com/pl/integracje/payment-form/formularz-niestandardowy/ -->
<!-- Scraped: 2026-04-19T14:29:32.372Z -->

- Homepage
- Jak zacząć
- Integracje  API  Przewodnik integracji   Formularz Płatności  Przewodnik integracji Formularz niestandardowy   Wtyczki  WooCommerce PrestaShop Magento Shoper   SDK (wersja beta)  Android iOS
- Metody płatności  MB WAY Karty płatnicze  Cartes Bancaires   BLIK  BLIK OneClick   Szybki przelew Apple Pay Google Pay Polecenie zapłaty SEPA Inne  Bancontact Bizum iDEAL | Wero
- Rodzaje transakcji  Autoryzacja Przechwytywanie Wstępnie autoryzowane przechwytywanie Zwrot Anulowanie Jednorazowy zakup
- Funkcjonalności płatności online  3D Secure Store cards  Zapamiętana karta bez zakupu Tokenizacja Płatności cykliczne Nieplanowana karta MIT w pliku   Karta OneClick  Zapisanie danych karty Płatność zapisaną kartą   Płatność podzielona Link do Płatności vTerminal Cross-border
- Płatności stacjonarne  Profile Płatności  Transakcje kartą Transakcje BLIKIEM Transakcje Apple Pay Transakcje Google Pay   Ustawienia Integracja app-to-app
- Onboarding API  Sprzedawca Sklep Terminal
- Finanse i raportowanie  Raportowanie Wypłaty
- Powiadomienia  Webhooki  Konfiguracja Operacje API Obsługa powiadomień   Wiadomości wychodzące
- SIBS Backoffice  Profile Konfiguracja sprzedawcy Panel Transakcje Zarządzanie tokenami Raportowanie Webhooki
- Pełna personalizacja
- Zasoby dla programistów  Punkty końcowe Do testowania Certyfikat API
- Aktualizacje
# Formularz niestandardowy
Ta sekcja wyjaśnia, jak dostosować Formularz Płatności, aby lepiej odpowiadał identyfikacji wizualnej Twojej marki oraz wymaganiom dotyczącym doświadczenia użytkownika.
Możesz kontrolować wygląd Formularza Płatności, korzystając z opcjonalnej konfiguracji formStyle podczas renderowania formularza na stronie checkout.
### Obsługiwane przeglądarki
Formularz Płatności został zaprojektowany z myślą o wysokich standardach bezpieczeństwa i wydajności.
Jest w pełni obsługiwany przez wszystkie główne, nowoczesne przeglądarki, które są aktywnie rozwijane i otrzymują aktualizacje zabezpieczeń, w tym:
- Google Chrome
- Microsoft Edge
- Mozilla Firefox
- Opera
- Safari
### Lekkie Dostosowanie
Lekkie dostosowanie umożliwia zmianę podstawowych elementów wizualnych, takich jak kolory i czcionki, zapewniając spójność z identyfikacją wizualną Twojej marki bez wpływu na standardowe działanie Formularza Płatności.
Dostosowanie to jest realizowane wyłącznie po stronie frontendu i nie wpływa na przetwarzanie backendowe ani walidację transakcji.
Aby zastosować te zmiany, dodaj atrybut spg-style podczas definiowania Formularza Płatności w Kroku 2.
Jak zastosować formStyle
```json
Copy Code</>HTML

<form class="paymentSPG"
      spg-context="{formContext}"
      spg-config="{formConfig}"
      spg-style='{formStyle}'>
</form>
```
Atrybut formStyle to ciąg JSON definiujący konfigurację wizualną Formularza Płatności.
Konfiguracja ta jest opcjonalna i wpływa wyłącznie na warstwę prezentacji.
Upewnij się, że wartość przekazana w spg-style jest poprawnym ciągiem JSON.
Struktura formStyle (przykład)
Poniżej znajduje się kompletny przykład konfiguracji formStyle:
```json
Copy Code</> JSON{  "layout": "default",  "theme": "default",  "color": {    "primary": "#FF5733",    "secondary": "",    "border": "#CCCCCC",    "surface": "#FFFFFF",    "header": {      "text": "payment",      "background": ""    },    "body": {      "text": "#333333",      "background": ""    }  },  "font": "Arial"}
```
| Parameter | Type | Example | Description |
| --- | --- | --- | --- |
| layout | string | „default” | Określa strukturę układu Formularza Płatności |
| theme | string | „default” | Określa motyw wizualny formularza (default, light, grey, dark) |
| color.primary | string | „#ff0000” | Kolor podstawowy używany dla przycisków i wyróżnień |
| color.secundary | string | „#ffffff” | Kolor dodatkowy używany w elementach pomocniczych UI |
| color.border | string | „#cccccc” | Kolor obramowania elementów formularza |
| color.surface | string | „#ffffff” | Kolor tła kontenera formularza |
| color.header.text | string | „#000000” | Kolor tekstu nagłówka |
| color.header.background | string | „#ffffff” | Kolor tła nagłówka |
| color.body.text | string | „#000000” | Domyślny kolor tekstu |
| color.body.background | string | „#ffffff” | Kolor tła treści formularza |
| font | string | „Arial” | Rodzina czcionek używana w Formularzu Płatności |
Wszystkie wartości kolorów muszą być podane w formacie szesnastkowym (hexadecimalnym). Nie ma ścisłych ograniczeń dotyczących wyboru kolorów, pod warunkiem że wartości są podane w poprawnym formacie.
Konfiguracja czcionki ma zastosowanie do wybranych elementów Formularza Płatności (np. przycisku płatności).
Jeśli formStyle nie zostanie zdefiniowany, zastosowany zostanie domyślny styl Formularza Płatności.
Poniżej znajduje się przykład ilustrujący, jak różne konfiguracje stylu wpływają na wygląd Formularza Płatności.
Formularz płatności SIBS: Dostosowanie Lite
### Pełne Dostosowanie (White label)
Pełne dostosowanie (white label) umożliwia jeszcze dokładniejsze dopasowanie Formularza Płatności oraz powiązanego doświadczenia użytkownika do identyfikacji Twojej marki.
Opcja ta pozwala na bardziej zaawansowaną konfigurację, obejmującą zarówno interfejs Formularza Płatności, jak i komunikację wysyłaną do klientów.
Dostępne są dwa poziomy dostosowania:
- Poziom 1: Formularz Płatności – dostosowanie wyglądu i interfejsu płatności
- Poziom 2: Formularz Płatności i komunikacja wychodząca – rozszerzenie dostosowania o komunikaty i wiadomości dla klientów
Pełne dostosowanie jest zazwyczaj aktywowane w ramach dedykowanej konfiguracji i może wymagać współpracy z zespołami SIBS.
Aby uzyskać więcej informacji, zapoznaj się z dedykowaną dokumentacją dotyczącą Pełnego Dostosowania.
### On this page:
- Obsługiwane przeglądarki
- Lekkie Dostosowanie
- Pełne Dostosowanie (White label)
Zamknij ustawienia ciasteczek RODO
- Przegląd prywatności
- Ściśle niezbędne ciasteczka
Ta strona korzysta z ciasteczek, aby zapewnić Ci najlepszą możliwą obsługę. Informacje o ciasteczkach są przechowywane w przeglądarce i wykonują funkcje takie jak rozpoznawanie Cię po powrocie na naszą stronę internetową i pomaganie naszemu zespołowi w zrozumieniu, które sekcje witryny są dla Ciebie najbardziej interesujące i przydatne.
Ściśle niezbędne ciasteczka
Niezbędne ciasteczka powinny być zawsze włączone, abyśmy mogli zapisać twoje preferencje dotyczące ustawień ciasteczek.
Włącz lub wyłącz ciasteczka