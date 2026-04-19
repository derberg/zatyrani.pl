<!-- Source: https://www.docs.pay.sibs.com/pl/integracje/payment-form/przewodnik-integracji/ -->
<!-- Scraped: 2026-04-19T14:29:25.962Z -->

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
# Przewodnik integracji
Zintegruj Formularz Płatności szybko i zacznij bezpiecznie przyjmować płatności, jednocześnie utrzymując wrażliwe dane poza swoimi systemami.
Ten przewodnik przeprowadzi Cię przez każdy etap integracji — od utworzenia zamówienia, przez wygenerowanie Formularza Płatności, aż po sprawdzenie statusu transakcji.
### Krok 1: Utworzenie zamówienia
Gdy klient jest gotowy do dokonania płatności, rozpocznij od utworzenia zamówienia.
Spowoduje to zainicjowanie transakcji oraz zdefiniowanie danych sprzedawcy, klienta i szczegółów transakcji wymaganych do przetwarzania płatności.
Dostępny endpoint (URL):
| Environment | URL | Operation method & Endpoint | Operation description |
| --- | --- | --- | --- |
| PROD | api.sibsgateway.com | api/version-id/payments | Wykonuje żądanie przygotowania danych wymaganych do checkoutu i zwraca Formularz Płatności. |
| TEST | stargate.qly.site[1|2].sibs.pt | api/version-id/payments | Tworzy transakcję w środowisku testowym. |
Ważne – Dane testowe
Jeśli sprzedawca planuje integrację w środowisku TEST, należy uzyskać dedykowane dane uwierzytelniające dla tego środowiska. Dane produkcyjne nie mogą być używane w środowisku TEST.
Używaj odpowiedniego adresu bazowego URL w zależności od środowiska (TEST lub PROD).
Proces tworzenia zamówienia wymaga trzech głównych kroków:
- Akcja 1: Zdefiniuj nagłówki i dodaj dane sprzedawcy oraz klienta
- Akcja 2: Dodaj informacje o transakcji do zamówienia
- Akcja 3: Skonfiguruj webhooki do aktualizacji transakcji
Akcja 1: Zdefiniuj nagłówki i dodaj dane sprzedawcy oraz klienta
Zdefiniuj nagłówki wymagane do uwierzytelnienia oraz przekaż dane sprzedawcy i klienta potrzebne do rozpoczęcia transakcji.Poniżej znajduje się pełny opis danych wymaganych do utworzenia zamówienia.
| Field | Type | Required | Description | Example |
| --- | --- | --- | --- | --- |
| Content-Type | string | Mandatory | Defines the content type of the request. | application/json |
| Authorization | string | Mandatory | Bearer token for authentication. | Bearer xxxxxxxx |
Wszystkie przykłady przedstawione w tej dokumentacji mają charakter poglądowy.
Sprzedawcy muszą dostarczyć prawidłowe dane zgodnie z lokalnymi wymogami regulacyjnymi, bankowymi oraz podatkowymi.
Zasady walidacji pól mogą się różnić w zależności od:
- kraju sprzedawcy
- konfiguracji acquirera
- metody płatności
- wymogów regulacyjnych (np. PSD2/SCA)
Poniższe obiekty definiują dane wymagane do utworzenia zamówienia i inicjalizacji Formularza Płatności.
| Field | Type | Condition | Description | Example |
| merchant.terminalId | numeric (≤10) | Mandatory | Identyfikator terminala sprzedawcy | 47215 |
| merchant.channel | string | Mandatory | Kanał używany do transakcji | Web |
| merchant.merchantTransactionId | string (≤1000) | Mandatory | Unikalny identyfikator transakcji | ORDER_123 |
| merchant.transactionDescription | string(≤4000) | Optional | Opis transakcji | Payment for order #001 |
| customer.customerInfo.customerName | string | Mandatory | Imię i nazwisko klienta | John Doe |
| customer.customerInfo.customerEmail | string | Mandatory | Email klienta | john@email.com |
| transaction.amount.value | number (double) | Mandatory | Kwota transakcji | 50.00 |
| transaction.amount.currency | string | Mandatory | Waluta (ISO 4217) | EUR |
| transaction.paymentMethod | array | Mandatory | Metody płatności do wyświetlenia | [„CARD”] |
UWAGA: Dla zalogowanych użytkowników pola CustomerName oraz CustomerEmail są obowiązkowe. Dzięki temu użytkownik nie będzie musiał ponownie wprowadzać tych danych w formularzu płatności.
Pełna struktura żądania (opcjonalna konfiguracja zaawansowana)
API obsługuje pełen zestaw pól umożliwiających zaawansowaną konfigurację, takich jak szczegółowe dane klienta, informacje o urządzeniu, adresy dostawy i rozliczeniowe oraz dodatkowe metadane.
W większości integracji Formularza Płatności pola te są opcjonalne i powinny być używane tylko wtedy, gdy jest to wymagane przez potrzeby biznesowe lub regulacyjne.
Aby uzyskać pełną listę obsługiwanych pól i szczegółową specyfikację, zapoznaj się z dokumentacją API Server-to-Server.
Akcja 2: Dodaj informacje o transakcji
Ta akcja definiuje samą transakcję, w tym kwotę, metodę płatności, znacznik czasu oraz inne atrybuty wymagane do prawidłowego przetworzenia płatności.Na tym etapie należy uwzględnić informacje o transakcji w zależności od metod płatności, które mają być wyświetlane w Formularzu Płatności.
transaction (object) – Mandatory
| Transaction | object | Mandatory | Szczegóły transakcji | – |
| transaction.transactionTimeStamp | ISODateTime | Mandatory | Znacznik czasu utworzenia transakcji | 2026-02-19T15:00:00.000Z |
| transaction.description | string (<=70) | Mandatory | Krótki opis transakcji | Payment for Order #20260220 |
| transaction.moto | boolean | Mandatory | Czy transakcja jest typu MOTO (Mail Order / Telephone Order) | False |
| transaction.paymentType | string | Mandatory | Typ płatności: “PURS” – zakup, “AUTH” – autoryzacja | PURS (Purchase) |
| transaction.paymentMethod | array | Mandatory | Dostępne wartości:„CARD” – Card „TOKEN” – Token „PAY_BY_LINK”- Pay by Link „BLIK” – BLIK „XPAY” – xPay „IDEL” – Ideal „BNCT” – Bancontact „SPDD” – SEPA Direct Debit „CRTB” – Cartes Bancaires „MBWY” – „MB WAY” „BIZM” – „Bizum” | [„CARD”,”BLIK”,”TOKEN”] |
| transaction.amount | object | Mandatory | Kwota i waluta transakcji | – |
1.2. Kwota (object) – wymagane
| transaction.amount | object | Mandatory | Kwota i waluta | – |
| transaction.amount.value | double | Mandatory | Kwota transakcji | 50.5 |
| transaction.amount.currency | string | Mandatory | Waluta ISO 4217 | PLN |
Sprawdź, jak wykonać jednorazową płatność lub preautoryzację (z późniejszym przechwyceniem środków).
Akcja 3: Skonfiguruj webhooki do aktualizacji transakcji
W tym kroku skonfigurujesz webhooki, aby automatycznie otrzymywać aktualizacje transakcji w czasie rzeczywistym, zapewniając, że Twój system zawsze posiada aktualny status płatności.
Dzięki konfiguracji webhooków możesz być powiadamiany o kluczowych zdarzeniach, takich jak udane płatności, błędy czy inne zmiany statusu transakcji, bez konieczności ciągłego odpytywania API.
Webhooki są zalecanym rozwiązaniem dla integracji produkcyjnych, ponieważ zapewniają aktualizacje w czasie rzeczywistym bez potrzeby wykonywania dodatkowych wywołań API.
Aby dowiedzieć się więcej o naszym rozwiązaniu webhooków, kliknij tutaj.
Poniżej znajduje się przykład utworzenia zamówienia:
Pełny przykład żądania (konfiguracja zaawansowana)
Poniższy przykład przedstawia kompletne żądanie zawierające pola opcjonalne oraz zaawansowane. W przypadku podstawowej integracji Formularza Płatności wymagany jest jedynie podzbiór tych pól.
Dodatkowe pola, takie jak informacje o urządzeniu czy rozszerzone dane, powinny być uwzględniane wyłącznie wtedy, gdy jest to konieczne — w zależności od potrzeb biznesowych lub wymogów regulacyjnych.
```json
Copy Code</> JSON
{
  "merchant": {
    "terminalId": 47215,
    "channel": "Web",
    "merchantTransactionId": "ORDER_20260309_001",
    "transactionDescription": "Payment for order #1001",
    "shopURL": "https://myshop.com"
  },
  "customer": {
    "customerInfo": {
      "customerName": "Jan Kowalski",
      "customerEmail": "jan.kowalski@example.com",
      "customerPhone": "+48500123456",
      "customerLanguage": "pl"
    },
    "shippingAddress": {
      "street1": "Marszalkowska 10",
      "street2": "Apartment 5",
      "city": "Warsaw",
      "postcode": "00-001",
      "countrySubDivision": "PL",
      "country": "PL"
    },
    "billingAddressSameAsShippingAddress": true
  },
  "transaction": {
    "transactionTimestamp": "2026-03-09T14:30:00.000Z",
    "description": "Order payment",
    "moto": false,
    "paymentType": "PURS",
    "paymentMethod": [
      "CARD",
      "BLIK"
    ],
    "amount": {
      "value": 50.50,
      "currency": "EUR"
    }
  },
  "info": {
    "deviceInfo": {
      "browserAcceptHeader": "text/html",
      "browserJavaEnabled": "true",
      "browserJavascriptEnabled": "true",
      "browserLanguage": "en-US",
      "browserColorDepth": "24",
      "browserScreenHeight": "1080",
      "browserScreenWidth": "1920",
      "browserTZ": "GMT+1",
      "browserUserAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "systemFamily": "Windows",
      "systemVersion": "10",
      "systemArchitecture": "x64",
      "deviceManufacturer": "Dell",
      "deviceModel": "XPS 15",
      "deviceID": "12345-67890",
      "applicationName": "Form:MyShopCheckout",
      "applicationVersion": "1.0",
      "geoLocalization": "52.2297,21.0122",
      "ipAddress": "192.168.1.10"
    }
  },
  "extendedInfo": [
    {
      "key": "loyaltyId",
      "value": "LTY-998877"
    }
  ]
}
```
### Krok 2: Utworzenie Formularza Płatności
Po utworzeniu zamówienia możesz wyświetlić Formularz Płatności na stronie checkout.
Ogólny przebieg integracji:
- Backend tworzy zamówienie
- Frontend renderuje Formularz Płatności na podstawie odpowiedzi
- Klient wprowadza dane płatności w bezpieczny sposób
- SIBS Gateway przetwarza płatność
- Backend pobiera końcowy status transakcji
Do tego wykorzystasz wartości transactionID oraz formContext zwrócone w Kroku 1.
Frontend odpowiada za renderowanie formularza, natomiast SIBS Gateway bezpiecznie obsługuje dane płatności.
Żadne wrażliwe dane płatnicze nie są przetwarzane ani przechowywane w Twoich systemach, ponieważ cały proces zbierania i przetwarzania danych jest bezpiecznie zarządzany przez SIBS Gateway, co pomaga zmniejszyć zakres PCI i nakład pracy związany ze zgodnością.
Renderowanie Formularza Płatności
Aby wyświetlić Formularz Płatności, należy dodać następujący kod HTML i JavaScript na stronie checkout oraz uzupełnić wymagane zmienne.
Dołącz skrypt Formularza Płatności, używając transactionID zwróconego w Kroku 1:
```json
Copy Code</> HTML
<script src="https://stargate.qly.site1.sibs.pt/assets/js/widget.js?id={transactionID}"></script>
```
Ten skrypt ładuje Formularz Płatności i powiązuje go z wcześniej utworzoną transakcją.
2. Dodaj kontener Formularza Płatności, używając formContext i formConfig:
```json
Copy Code</> HTML
<form class="paymentSPG" spg-context="{formContext}" spg-config="{formConfig}"></form>
```
formContext jest zwracany w odpowiedzi z Kroku 1 i zawiera bezpieczne dane sesji wymagane do inicjalizacji formularza.formConfig jest definiowany przez Ciebie i kontroluje sposób wyświetlania oraz działanie Formularza Płatności.
Pozwala on kontrolować, w jaki sposób formularz jest wyświetlany, w tym:
- Które metody płatności są pokazywane
- Kwotę i walutę transakcji
- Język formularza
- Zachowanie po dokonaniu płatności (przekierowanie)
```json
Copy Code</> JavaScript

const CHECKOUT_REQUEST_EXAMPLE = {
  "merchant": {
    "terminalId": 47215,
    "channel": "web",
    "merchantTransactionId": "5351136"
  },
  "transaction": {
    "transactionTimestamp": "2020-05-20T15:41:56.971Z",
    "description": "Transaction short description",
    "moto": false,
    "paymentType": "AUTH",
    "amount": {
      "value": 5,
      "currency": "EUR"
    },
    "paymentMethod": [
      "REFERENCE",
      "CARD",
      "MBWAY"
    ],
    "paymentReference": {
      "initialDatetime": "2020-05-20T15:41:56.971Z",
      "finalDatetime": "2020-12-31T15:41:56.971Z",
      "maxAmount": { "value": 5, "currency": "EUR" },
      "minAmount": { "value": 5, "currency": "EUR" },
      "entity": "25100"
    }
  }
};

const FORM_CONFIG_EXAMPLE = {
  "paymentMethodList": [""],
  "amount": { "value": 2, "currency": "EUR" },
  "language": "en",
  "redirectUrl": "https://www.google.com/"
};
```
| Parameter | Type | Available values | Description |
| paymentMethodList | string | Multiple | Określa metody płatności wyświetlane w formularzu.Powinno to być zgodne z paymentMethodList zwróconym w odpowiedzi z Kroku 1, aby zapewnić, że klientowi wyświetlane są wyłącznie dostępne metody płatności.. |
| amount |  | – | Kwota i waluta |
| language | string | en, pl, nl, fr, de, cs, pt, ro, es, bg, lt | Język formularza (ISO 639-1 format) |
| redirectUrl | string | – | URL przekierowania po płatności |
Opcjonalna personalizacja
Możesz dostosować wygląd formularza za pomocą formStyle.Szczegóły znajdziesz w sekcji dotyczącej personalizacji formularza.
Co dzieje się po płatności
Po przetworzeniu płatności:
- Wyświetlana jest strona statusu transakcji;
- Klient zostaje automatycznie przekierowany na redirectUrl.
Zapewnia to płynne doświadczenie podczas finalizacji zamówienia, przy jednoczesnym tym, że wszystkie wrażliwe dane płatnicze są obsługiwane przez SIBS.
Podgląd Formularza Płatności
Poniżej można zobaczyć Formularz Płatności w jego domyślnym układzie, dostępnym zarówno na komputerach, jak i urządzeniach mobilnych:
### Krok 3: Pobranie statusu płatności
Po zakończeniu procesu możesz pobrać końcowy status transakcji za pomocą żądania GET.
Pozwala to uruchomić logikę biznesową (np. realizację zamówienia lub powiadomienia), zweryfikować wynik płatności oraz zaktualizować status zamówienia.
```json
Copy Code</> HTTP

GET https://stargate.qly.site1.sibs.pt/api/v1/payments/{transactionID}/status
```
Authorization: Bearer <AuthToken>X-IBM-Client-Id: <ClientId>Content-Type: application/jso
### On this page:
- Krok 1: Utworzenie zamówienia
- Krok 2: Utworzenie Formularza Płatności
- Krok 3: Pobranie statusu płatności
Zamknij ustawienia ciasteczek RODO
- Przegląd prywatności
- Ściśle niezbędne ciasteczka
Ta strona korzysta z ciasteczek, aby zapewnić Ci najlepszą możliwą obsługę. Informacje o ciasteczkach są przechowywane w przeglądarce i wykonują funkcje takie jak rozpoznawanie Cię po powrocie na naszą stronę internetową i pomaganie naszemu zespołowi w zrozumieniu, które sekcje witryny są dla Ciebie najbardziej interesujące i przydatne.
Ściśle niezbędne ciasteczka
Niezbędne ciasteczka powinny być zawsze włączone, abyśmy mogli zapisać twoje preferencje dotyczące ustawień ciasteczek.
Włącz lub wyłącz ciasteczka