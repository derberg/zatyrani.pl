<!-- Source: https://www.docs.pay.sibs.com/pl/powiadomienia/webhooki/operacje-api/ -->

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
# Operacje API
W tej sekcji zagłębimy się w operacje webhook API (FULL CODE), obejmujące procesy tworzenia webhooków, pobierania listy webhooków i aktualizacji webhooków, obejmujące różne aspekty, takie jak metoda operacji, punkt końcowy (endpoint) i szczegóły żądania.
### Utwórz webhook
W tym segmencie zbadamy proces tworzenia webhooków, przedstawiając niezbędne kroki, parametry i szczegóły uwierzytelniania.
| Operacje | Typ operacji | Metoda działania i punkt końcowy | Opis operacji |
| --- | --- | --- | --- |
| Tworzenie żądania Webhook | Połączenie | POST version-id/acquirers/{acquirer-id}/merchants/{merchant-id}/terminal/webhook | Skonfiguruj zasób tworzenia elementu Webhook. |
Poniższa tabela przedstawia szczegóły wymagane do zainicjowania operacji Utwórz Webhook:
| Lokalizacja | Element danych | Typ | Stan | Opis |
| --- | --- | --- | --- | --- |
| Ścieżka | acquirer-id | Max25NumericText | Obowiązkowe | Kod nabywcy |
| Ścieżka | merchant-id | Max10NumericText | Obowiązkowe | Kod nabywcy |
| Parametr zapytania | acceptorId | Max10NumericText | Opcjonalnie | Kod nabywcy |
| Parametr zapytania | terminalId | Max10NumericText | Opcjonalnie | Kod terminala (Terminal Code) |
| Element danych | Typ | Stan | Opis |
| Content-Type | String | Obowiązkowe | application/json |
| Autoryzacja | String | Obowiązkowe | Token okaziciela. Na podstawie uwierzytelniania OAuth2 przeprowadzonego w kroku wstępnym. |
| x-ibm-client-id | String | Obowiązkowe | Token identyfikujący organizację klienta. Jest on dostarczany podczas procesu wdrażania i musi być używany w każdym połączeniu. |
| TPP-Request-ID | String | Obowiązkowe | Identyfikator żądania, unikalny dla połączenia, określony przez stronę inicjującą. |
| User-ID | String | Obowiązkowe | Identyfikacja użytkownika odpowiedzialnego za żądanie (wymagana do celów audytu). |
| User-Organization-ID | String | Obowiązkowe | Identyfikacja organizacji odpowiedzialnej za wniosek (wymagana do celów audytu). |
| Treść żądania | notificationConfigurationCode | Max35Text | Obowiązkowe | UUID konfiguracji powiadomienia |
| Treść żądania | requestOperationType | Max3Text | Obowiązkowe | Kod typu operacji żądaniaEnum:INS – WstawDEL – UsuńUstaw za pomocą 'INS’. |
| Treść żądania | paymentMethods | Metody płatności | Obowiązkowe | Szereg metod płatności |
| Request Body.paymentMethods | paymentMethodNotificationCode | Max15Text | Obowiązkowe | Kod typu powiadomienia o metodzie płatnościEnum:MBWY-’MB WAY’CARD-’Card Payments’BLIK-’BLIK’PYBL-’Pay By Link – Blue Media’XPAY-’XPAY Payments’ BNCT-’Bancontact’IDEL-’Ideal’ |
| Treść żądania | channelTypeNotification | Typ kanału Powiadomienie | Obowiązkowe | Zawiera wszystkie dane związane z powiadomieniem o typie kanału. |
| Treść żądania.channelTypeNotification | notificationType | Max5Text | Obowiązkowe | Kod typu powiadomieniaEnum:EMAILURL |
| Treść żądania.channelTypeNotification | wartość | Max2048Text | Obowiązkowe | Wartość powiadomienia (email or URL) |
| Treść żądania.channelTypeNotification | bezpieczeństwo | Bezpieczeństwo | Warunkowy | Obejmuje on wszystkie dane związane z bezpieczeństwem.Ta struktura (i wszystkie powiązane elementy danych) powinna być prezentowana tylko wtedy, gdy wartość kodu typu powiadomienia to „URL”. |
| Treść żądania.channelTypeNotification.security | klucz | Max32Text (Base64) | Warunkowy | Klucz bezpieczeństwa (tajny). |
| Treść żądania.channelTypeNotification.security | supportEmail | Max256Text | Warunkowy | E-mail wsparcia. |
| Treść żądania.channelTypeNotification.security | algorytm | Max70Text | Warunkowy | AlgorytmUstawienie 'AES-256-GCM’. |
W tym miejscu można przejrzeć strukturę odpowiedzi wynikającą z operacji  Utwórz Webhook :
| Nagłówek odpowiedzi | TPP-Request-ID | UUID | Obowiązkowe | Identyfikator żądania, unikalny dla połączenia, określony przez stronę inicjującą. |
| Treść odpowiedzi | transactionStatus | Status transakcji | Obowiązkowe | Status transakcji Możliwe wartości to „ACTC-Accepted Technical Validation” i „RJCT-Rejected”. |
| Treść odpowiedzi | returnStatus | Status zwrotu | Obowiązkowe |  |
| Treść odpowiedzi.returnStatus | statusCode | Kod wiadomości | Obowiązkowe | „000” oznacza sukces. Wartości różne od „000” oznaczają błędy. |
| Treść odpowiedzi.returnStatus | statusMsg | Typ wiadomości | Obowiązkowe | Komunikat o wynikach. |
| Treść odpowiedzi.returnStatus | statusDescription | Max512Text | Obowiązkowe | Dodatkowy tekst wyjaśniający. |
### Pobierz listę webhooków
W tej sekcji przedstawiamy szczegółowe informacje na temat operacji Pobierz listę Webhooków, obejmujące metodę operacji, Punkt końcowy (Endpoint) i elementy niezbędne do pobrania listy webhooków, wraz ze strukturami żądania i odpowiedzi API (FULL CODE) w celach informacyjnych.
| Żądanie 'Pobierz listę webhooków’ | Połączenie | POST version-id/webhooks | Pobierz listę webhooków. |
Poniższa tabela przedstawia wymagane elementy danych i ich warunki inicjowania żądania.
| Nagłówek żądania | Content-Type | String | Obowiązkowe | application/json |
| Nagłówek żądania | Autoryzacja | String | Obowiązkowe | Token okaziciela. Na podstawie uwierzytelniania OAuth2 przeprowadzonego w kroku wstępnym. |
| Nagłówek żądania | x-ibm-client-id | String | Obowiązkowe | Token identyfikujący organizację klienta. Jest on dostarczany podczas procesu wdrażania i musi być używany w każdym połączeniu. |
| Nagłówek żądania | TPP-Request-ID | UUID | Obowiązkowe | Identyfikator żądania, unikalny dla połączenia, określony przez stronę inicjującą. |
| Nagłówek żądania | User-ID | String | Obowiązkowe | Identyfikacja użytkownika odpowiedzialnego za żądanie (wymagana do celów audytu). |
| Nagłówek żądania | User-Organization-ID | String | Obowiązkowe | Identyfikacja organizacji odpowiedzialnej za wniosek (wymagana do celów audytu). |
| Treść żądania | acquirerId | Max25NumericText | Obowiązkowe | Kod nabywcy |
| Treść żądania | merchantId | Max10NumericText | Obowiązkowe | Kod sprzedawcy |
| Treść żądania | acceptorId | Max10NumericText | Opcjonalnie | Kod akceptora |
| Treść żądania | terminalId | Max10NumericText | Opcjonalnie | Kod terminala (Terminal Code) |
Tabela przedstawia oczekiwane elementy odpowiedzi:
| Nagłówek odpowiedzi | TPP-Request-ID | UUID | Obowiązkowe | Identyfikator odpowiedzi, unikalny dla połączenia, określony przez stronę inicjującą. |
| Treść odpowiedzi.returnStatus | statusCode | Status transakcji. | Obowiązkowe | „000” oznacza sukces. Wartości różne od „000” oznaczają błędy. |
| Treść odpowiedzi | webhooks | Tablica webhooków | Warunkowy | Lista danych szczegółowych zasobu webhook.Występuje tylko w odpowiedziach pomyślnych. |
| Response Body.webhooks | webhook | Webhook | Obowiązkowe | Tablica webhooków |
| Response Body.webhooks.webhook | notificationConfigurationCode | Max36Text | Obowiązkowe | UUID konfiguracji powiadomienia |
| Treść odpowiedzi | paymentMethods | metody płatności | Obowiązkowe | Szereg metod płatności |
| Response Body.paymentMethods | paymentMethodNotificationCode | Max15Text | Obowiązkowe | Kod typu powiadomienia o metodzie płatnościEnum:CARD-’Płatności kartą’PYBL-’Pay By Link – Blue Media’PLKV-’Pay By Link – kevin’BLIK-’BLIK’XPAY-’XPAY Payments’ BNPL-’Buy Now Pay Later -Paywerk’BNCT-’Bancontact’IDEL-’Ideal’ |
| Response Body.webhooks.webhook | channelTypeNotification | Typ kanału Powiadomienie | Obowiązkowe | Zawiera wszystkie dane związane z powiadomieniem o typie kanału. |
| Response Body.webhooks.webhook.channelTypeNotification | notificationType | Max5Text | Obowiązkowe | Kod typu powiadomieniaEnum:EMAILURL |
| Response Body.webhooks.webhook.channelTypeNotification | wartość | Max2048Text | Obowiązkowe | Wartość powiadomienia (email or URL). |
| Response Body.webhooks.webhook.channelTypeNotification | bezpieczeństwo | Bezpieczeństwo | Warunkowy | Obejmuje on wszystkie dane związane z bezpieczeństwem.Ta struktura (i wszystkie powiązane elementy danych) powinna być prezentowana tylko wtedy, gdy wartość kodu typu powiadomienia to „URL”. |
| Response Body.webhooks.webhook.channelTypeNotification.security | klucz | Max32Text (Base64) | Warunkowy | Klucz bezpieczeństwa (tajny). |
| Response Body.webhooks.webhook.channelTypeNotification.security | supportEmail | Max256Text | Warunkowy | E-mail wsparcia. |
| Response Body.webhooks.webhook.channelTypeNotification.security | algorytm | Max70Text | Warunkowy | Algorytm. |
### Aktualizacja webhooków
Tutaj omawiamy metodę operacji, Punkt końcowy (Endpoint) i odpowiednie elementy wymagane do modyfikacji zasobu webhook. Obejmuje to omówienie struktur żądań i odpowiedzi API (FULL CODE) w celach informacyjnych.
| Żądanie aktualizacji Webhook | Połączenie | PUT version-id/acquirers/{acquirer-id}/merchants/{merchant-id}/terminal/webhook | Aktualizacja zasobu Webhook. |
Poniższa tabela przedstawia podstawowe elementy niezbędne do zainicjowania żądania Aktualizacja Webhook:
| Ścieżka | merchant-id | Max10NumericText | Obowiązkowe | Kod sprzedawcy |
| Parametr zapytania | acceptorId | Max10NumericText | Opcjonalnie | Kod akceptanta w programie Merchant |
| Parametr zapytania | terminalId | Max10NumericText | Opcjonalnie | Kod terminala (Terminal Code). |
| Treść żądania | paymentMethods | metody płatności | Obowiązkowe | Szereg metod płatności |
| Treść żądania.channelTypeNotification.security | klucz | Max32Text | Warunkowy | Klucz bezpieczeństwa (tajny). |
Tabela przedstawia komponenty odpowiedzi dla operacji Aktualizacja Webhook:
### On this page:
- Utwórz webhook
- Pobierz listę webhooków
- Aktualizacja webhooków
- Przegląd prywatności
- Ściśle niezbędne ciasteczka
Ta strona korzysta z ciasteczek, aby zapewnić Ci najlepszą możliwą obsługę. Informacje o ciasteczkach są przechowywane w przeglądarce i wykonują funkcje takie jak rozpoznawanie Cię po powrocie na naszą stronę internetową i pomaganie naszemu zespołowi w zrozumieniu, które sekcje witryny są dla Ciebie najbardziej interesujące i przydatne.
Niezbędne ciasteczka powinny być zawsze włączone, abyśmy mogli zapisać twoje preferencje dotyczące ustawień ciasteczek.