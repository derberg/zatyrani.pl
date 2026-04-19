<!-- Source: https://www.docs.pay.sibs.com/pl/integracje/api/integration-guide/ -->
<!-- Scraped: 2026-04-19T14:29:19.612Z -->

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
Wykorzystaj nasze API do otrzymywania płatności i stwórz własny formularz płatności, aby uzyskać pełną kontrolę nad wyglądem i doświadczeniem użytkownika na stronie płatności. Postępuj zgodnie z poniższymi instrukcjami, aby rozpocząć przyjmowanie płatności.
### Krok 1: Utwórz zamówienie
W tym kroku opisano, jak utworzyć zamówienie, gdy kupujący jest gotowy do zapłaty.
Dostępny docelowy adres URL punktu końcowego (Endpoint):
| Środowisko | URL | Metoda działania i punkt końcowy | Opis operacji |
| --- | --- | --- | --- |
| PROD | api.sibsgateway.com | POST api/version-id/payments | Wykonuje żądanie przygotowania wymaganych danych checkout’u i zwraca je wraz z formularzem płatności. |
| TEST | stargate.qly.site[1|2].sibs.pt | POST api/version-id/payments | Wykonuje żądanie przygotowania wymaganych danych checkout’u i zwraca je wraz z formularzem płatności. |
Jeśli chodzi o dane wymagane do utworzenia zamówienia, proces jest prosty i wymaga tylko kilku czynności:
Działanie 1: Zdefiniowanie nagłówka i dodanie informacji o sprzedawcy i kliencie
Działanie 2: Dodanie informacji o transakcji do zamówienia
Działanie 3: Wypełnij zamówienie, podając dodatkowe i opcjonalne informacje.
Sprawdź poniżej pełny opis wymaganych danych, aby rozpocząć tworzenie zamówienia
application/json
Bearer Token. Based on OAuth2 authentication performed in a pre-step.
Token that identifies a client organization. It is provided during onboarding process and must be used in every call.
An optional element to query transaction status.
numeric [<= 10 characters]
Merchant Terminal Identification.
Merchant channel, Possible Value “Web”.
merchantTransactionID
string [<= 35 characters]
Unique Id used by the Merchant.
transactionDescription
Merchant Transaction Short Description.
Merchant Shop URL for redirect purposes.
Merchant’s website identifier for customer redirection.
Object that defines a customer.
Object that defines the predefined customer information.
Customer Name.
Customer e-mail
language code ISO 639-1
Customer language
This element is mandatory if intended payment method is one of the following:
„BNCT” – „Bancontact”; „IDEL” – iDEAL; „SFRT” – „Sofort”; “PY24” – “Przelewy24”
Customer Address. When applicable used for shipping products.
string <= 70 characters
Shipping address street.
Shipping address street – additional street.
string <= 35 characters
Shipping address city or town.
string <= 16 characters
Shipping address Postal Code.
Country code ISO 3166-1 Alpha 2
Shipping country code.
Customer billing address.
string <= 60 characters
country code ISO 3166-1 Alpha 2
billingAddressSameAsShippingAddress
Flag to identify if the billing address is the same of shipping address.
Teraz nadszedł czas, aby dołączyć informacje o transakcjach w oparciu o metody płatności, które chcesz wyświetlać w swoim paywallu.
Parametry żądania: application/json
Object that defines a transaction.
ISODateTime
Transaction timestamp.
Transaction short description.
Indicates if is a Mail Order Telephone Order.
allowed values: “PURS” – Purchase “AUTH” – Authorization
Define the of payment used by the client.
allowed values: „CARD” „TOKEN” „PBLKV” „BLIK” „XPAY” „BNPL” „SFRT” „IDEL” „BNCT” “PY24” “CRTB” “MBWY”
Method of payment used by the client.
Parameter with the value and currency of the transaction.
number: Double
Amount in the transaction.
currency code: ISO 4217 Alpha-3 Code
Currency used in the transaction.
Sprawdź, jak dokonać jednorazowego zakupu lub wstępnie autoryzowanego przechwytywania.
W tym kroku pokazujemy, że istnieje wiele opcjonalnych informacji, które można dodać, aby zakończyć tworzenie zamówienia. Poniżej znajdują się dodatkowe informacje oparte na niektórych przypadkach użycia:
Autoryzacja płatności z uwierzytelnianiem 3D Secure.
Zapisz dane kupującego i dokonuj płatności cyklicznych i subskrypcyjnych.
Aktywuj najszybszy i najbardziej płynny sposób przyjmowania płatności.
Aktualizuj swój system o zdarzeniach płatniczych i zmianach statusu.
Oto przykład tworzenia zamówienia:
```json
Copy Code{
    "merchant": {
        "terminalId": 24,
        "channel": "web",
        "merchantTransactionId": "Order Id: 9bzraklk4v",
        "transactionDescription": "transaction short description",
        "shopURL": "https://mytest.e-shop.pl/"
    },
    "transaction": {
        "transactionTimestamp": "2023-05-15T20:11:11.488Z",
        "description": "transaction statement description",
        "moto": false,
        "paymentType": "PURS",
        "amount": {
            "value": 50.5,
            "currency": "PLN"
        },
        "paymentMethod": [
            "CARD",
            "BLIK",
            "PBLKV"
        ]
    }
}
```
### Krok 2: Uzyskanie odpowiedzi
Odpowiedź zawieta statusMsg, transactionID, transactionSignature listę dostępnych paymentMethodList które można wyświetlić.
```json
Copy Code{
    "returnStatus": {
        "statusCode": "000",
        "statusMsg": "Success",
        "statusDescription": "string"
    },
    "transactionID": "42f59038f3f14e618d091da8bf3b717e9999",
    "transactionSignature": "42f59038f3f14e618d091da8bf3b717e9999",
    "amount": {
        "value": 50.50,
        "currency": "PLN"
    },
    "merchant": {
        "terminalId": 47215,
        "channel": "web",
        "merchantTransactionId": "5351136",
        "transactionDescription": "string",
        "shopURL": "string",
        "websiteAddress": "string"
    },
    "paymentMethodList": "",
    "tokenList": []
}
```
Odpowiedź zawiera statusMsg które mogą przyjmować różne wartości:
| Kod wyniku | statusMsg | Opis | Akcja |
| HTTP-200 | Sukces | Odpowiedź sukcesu | n/a |
| HTTP-400 | Zła prośba | Ładunek JSON nie jest zgodny z definicją API lub brakuje niektórych obowiązkowych nagłówków HTTP. | Sprawdź w API Market poprawną składnię. |
| HTTP-401 | Nieautoryzowany | W przypadku Autoryzacji token okaziciela jest nieprawidłowy/wygasł lub nie jest powiązany z używanym terminalem. | Sprawdź w SIBS Backoffice w sekcji Poświadczenia, czy token jest ważny i w razie potrzeby utwórz nowy. |
| HTTP-403 | Zabroniony | Identyfikator klienta ustawiony w nagłówku HTTP X-IBM-Client-Id jest nieprawidłowy lub nie posiada ważnej subskrypcji interfejsu API. | Sprawdź w SIBS Backoffice w SPG APP 2.0, czy ClientID jest poprawny. Jeśli problem będzie się powtarzał, skontaktuj się z pomocą techniczną SIBS Gateway w celu zresetowania ClientID. |
| HTTP-405 | Niedozwolona metoda | Zastosowana metoda HTTP nie jest zgodna z żadną dostępną definicją API. | Sprawdź w API Market poprawną metodę HTTP. |
| HTTP-429 | Zbyt dużo zapytań | Przekroczono limit szybkości wywołań API. | Informacje na temat limitów stawek mających zastosowanie do API można znaleźć w API Market. |
| HTTP-500 | Wewnętrzny błąd serwera | Wywołanie API nie powiodło się… i najprawdopodobniej jest to po naszej stronie. | Powinieneś ponowić operację, a jeśli problem będzie się powtarzał, skontaktuj się z pomocą techniczną SIBS Gateway w celu uzyskania pomocy. |
| HTTP-503 | serwis niedostępny | Wywołanie API nie jest obecnie dostępne. Zwykle jesteśmy zawsze aktywni, ale podczas planowej konserwacji mogą wystąpić krótkie problemy z dostępnością. | Powinieneś poczekać i spróbować ponownie później. |
### Krok 3: Dokonaj płatności
Po utworzeniu i przesłaniu zamówienia z danymi płatności kupującego, który zdecyduje się zapłacić za pomocą metody płatności wymagającej przekierowania, należy złożyć wniosek o płatność do SIBS Gateway.
Sprawdź instrukcje dotyczące dokonywania płatności za pomocą każdego rodzaju metody płatności:
Visa, Mastercard oraz marki partnerskie. Wygodne i bezpieczne płatności.
Najlepszy system natychmiastowych płatności mobilnych w Polsce.
Wygodną płatność online za pomocą konta bankowego.
### On this page:
- Krok 1: Utwórz zamówienie
- Krok 2: Uzyskanie odpowiedzi
- Krok 3: Dokonaj płatności
Zamknij ustawienia ciasteczek RODO
- Przegląd prywatności
- Ściśle niezbędne ciasteczka
Ta strona korzysta z ciasteczek, aby zapewnić Ci najlepszą możliwą obsługę. Informacje o ciasteczkach są przechowywane w przeglądarce i wykonują funkcje takie jak rozpoznawanie Cię po powrocie na naszą stronę internetową i pomaganie naszemu zespołowi w zrozumieniu, które sekcje witryny są dla Ciebie najbardziej interesujące i przydatne.
Ściśle niezbędne ciasteczka
Niezbędne ciasteczka powinny być zawsze włączone, abyśmy mogli zapisać twoje preferencje dotyczące ustawień ciasteczek.
Włącz lub wyłącz ciasteczka