<!-- Source: https://www.docs.pay.sibs.com/pl/metody-platnosci/szybki-przelew/ -->
<!-- Scraped: 2026-04-19T14:29:58.619Z -->

- Homepage
- Jak zacząć
- Integracje  API  Przewodnik integracji   Formularz Płatności  Przewodnik integracji Formularz niestandardowy   Wtyczki  WooCommerce PrestaShop Magento Shoper   SDK (wersja beta)  Android iOS
- Metody płatności  MB WAY Karty płatnicze  Cartes Bancaires   BLIK  BLIK OneClick   Szybki przelew Apple Pay Google Pay Polecenie zapłaty SEPA SEPA Credit Transfer (Przelew) Inne  Bancontact Bizum iDEAL | Wero
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
# Szybki przelew
Szybki przelew (PayByLink) to znana w Polsce metoda płatności, która umożliwia klientom płacenie za zakupy w Internecie za pomocą konta bankowego. SIBS Payment Gateway zapewnia interfejs API umożliwiający integrację z usługami szybkiego przelewu poprzez wzorzec Web Redirect.
Interfejs API umożliwia przedstawienie klientowi płatności ze wszystkimi adresowalnymi podmiotami. Gdy klient wybierze podmiot, którego chce użyć, wystarczy wywołać API, które poda Ci odpowiedni adres URL przekierowania.
Płatność Szybkim przelewem – przykład desktopowego i mobilnego interfejsu użytkownika.
| Metoda płatności | Kategoria | Kraje | Waluty | Funkcjonalności | Integracje |
| --- | --- | --- | --- | --- | --- |
| Szybki przelew (PayByLink) | Bankowość online | Polska | PLN | Zwroty kosztówAnulowanie | API Formularz Płatności Wtyczka Prestashop Wtyczka WooCommerce Wtyczka Magento |
### Jak to działa
Zanim zaczniesz, powinieneś utworzyć żądanie zamówienia z PayByLink (Szybkim przelewem) jako metodą płatności.
Następnie należy wykonać następujące kroki:
Krok 1: Uzyskaj listę podmiotów Szybkiego przelewu i przedstaw je klientowi
Krok 2: Wywołaj API, aby uzyskać Listę Regulacji
Krok 3: Wywołaj API, aby uzyskać ważny link do płatności dla wybranego podmiotu
Krok 4: Uzyskaj status płatności, aby poznać wynik płatności
### Krok 1: Uzyskaj listę podmiotów Szybkiego przelewu i przedstaw je klientowi
Możesz sprawdzić listę wszystkich podmiotów PayByLink (Szybkiego przelewu) składających żądanie GET.
Należy pamiętać, że żądanie wymaga nagłówka autoryzacji ze znakiem mark, transactionsSignature zwróconym z operacji realizacji transakcji.
Sprawdź poniżej jak uzyskać listę kanałów płatności:
| Operacja | Typ operacji | Metoda działania i punkt końcowy | Opis operacji | Obserwacje |
| --- | --- | --- | --- | --- |
| Uzyskaj listę kanałów płatności | Połączenie synchroniczne | POST https://{{APIHost}}/api/v1/paymentChannels | Wykonaj transakcję i zgłoś Listę kanałów płatności. | Content-Type: application/x-www-form-urlencoded |
| Lokalizacja | Element danych | Typ | Warunek | Opis |
| Nagłówek HTTP | Autoryzacja | Ciąg | Opcjonalny | Przykład: Nośnik *accessToken*
Token dostępu użytkownika. Musi to być schemat na okaziciela. Nie dotyczy płatności hybrydowych. |
| Nagłówek/autoryzacja HTTP | Identyfikator klienta | Klucz API | Obowiązkowy | Identyfikator klienta projektu. Należy podać w nagłówku każdego żądania. |
| Nagłówek/autoryzacja HTTP | Client-Secret | Klucz API | Obowiązkowy | Sekret klienta projektu. Należy podać w nagłówku każdego żądania. |
W tym żądaniu token okaziciela zostaje zastąpiony przez odpowiedź z kasy transactionSignature.
countryCode(opcjonalne) – Pole wyjściowe informujące do jakiego kraju należy dany bank.
Oczekiwana odpowiedź:
Pomyślna odpowiedź techniczna składa się ze statusu HTTP-200 i returnStatus.statusCode=”000″.
W przypadku pomyślnych odpowiedzi otrzymasz następujące dodatkowe dane:
Lista Payment Channels (Kanałów Płatności):
```json
Copy Code"paymentChannels": [
		{
		"gatewayId": "PBL Gateway ID",
		"gatewayName": "Name to present to customer",
		"gatewayType": "PBL",
		"bankName": "technical bank name",
		"iconURL" : "https://paybylink.bank.pl/grafika/pbl.gif",
                "statusDate": "2023-10-03T14:35:01"
		}
]
```
### Krok 2: Wywołaj API, aby uzyskać Listę Regulacji
Po uzyskaniu listy dostępnych podmiotów dla Szybkiego przelewu należy wykonać żądanie POST w celu otrzymania listy regulacji dla wybranego banku.
| Element danych | Typ | Warunek | Opis |
| --- | --- | --- | --- |
| gatewayId | String | Obowiązkowy | Identyfikator Kanału Płatności (Payment Channel), dla kanału, którego Klient będzie używał do dokonywania płatności. |
W tym żądaniu token okaziciela zostaje zastąpiony odpowiedzią kasy „transactionSignature”.
```json
Copy Codehttps://stargate.qly.site1.sibs.pt/api/v1/regulations
```
```json
Copy CodeAuthorization: Digest {transactionSignature}
X-IBM-Client-Id: b4480347-9fc8-4790-b359-100a99c60ea3
Content-Type: application/json
```
```json
Copy Code{
    "body": {
        "gatewayId": "106"
     }
}
```
Po zakończeniu operacji odpowiedź API będzie zawierać identyfikator regulacji (regulation ID):
- unikalny identyfikator konkretnej regulacji
- Adres URL zawierający bardziej szczegółowe informacje o regulacji, do której użytkownik może uzyskać dostęp
- rodzaj regulacji
- inputLabel, który wskazuje, czy z tą regulacją jest powiązana jakakolwiek etykieta wejściowa (input label).
Poniżej przykład odpowiedzi:
```json
Copy Code{
   "transactionStatus": "ACTC",
   "returnStatus": {
       "statusCode": "000",
       "statusMsg": "Success",
       "statusDescription": "Success"
   },
   "regulations": [
       {
           "regulationId": "11984",
           "url": "https://testpay.autopay.eu/webapi/regulation?ServiceID=903463&MessageID=e263bda2bc47536670569a1be8f691bd&Type=DEFAULT&Language=PL&Hash=6ab4a5df336351bdcb31c747ae46c54b3c554c2ddfed289584a4a53049ff3088",
           "type": "DEFAULT",
           "inputLabel": "null"
       }
   ]
}
```
### Krok 3: Wywołaj API, aby uzyskać ważny link do płatności dla wybranego podmiotu
Pamiętaj, że poniższe żądanie wymaga nagłówka autoryzacji z podpisem transakcji zwróconym z operacji realizacji transakcji i powinieneś uwzględnić te dwa elementy poniżej:
| gatewayId | Ciąg | Obowiązkowy | Identyfikator kanału płatności dla kanału, którego klient zamierza użyć do dokonania płatności. |
| userAcceptanceIndicator | Wartość logiczna | Obowiązkowy | Wskazuje, czy użytkownik zaakceptował Regulamin w celu kontynuowania płatności. |
```json
Copy Codehttps://stargate.qly.site1.sibs.pt/api/v1/payments/{transactionID}/pbl/payment-link
```
```json
Copy Code{
    "info": {
        "deviceInfo": {
            "browserAcceptHeader": "application/json, text/plain, */*",
            "browserJavaEnabled": "false",
            "browserLanguage": "en",
            "browserColorDepth": "24",
            "browserScreenHeight": "1080",
            "browserScreenWidth": "1920",
            "browserTZ": "-60",
            "browserUserAgent": "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36",
            "geoLocalization": "Lat: 38.7350528 | Long: -9.2143616",
            "systemFamily": "Windows",
            "systemVersion": "Windows",
            "deviceID": "498bfd4c3a3645b38667a7037b616c18",
            "applicationName": "Chrome",
            "applicationVersion": "106"
        },
        "customerInfo": [
            {
                "key": "customerName",
                "value": "Test Name"
            },
            {
                "key": "customerEmail",
                "value": "email@provider.com"
            }
        ]
    },
    "gatewayId": "106",
    "userAcceptanceIndicator": true,
    "merchant": {
        "merchantURL": "https://egadget2.azurewebsites.net/#/returns?id={{transactionId}}"
    }
}
```
Po zakończeniu operacji powinieneś otrzymać status oczekującej płatności.
Użytkownik zostanie przekierowany do środowiska PBL w celu potwierdzenia płatności, a następnie z powrotem na adres URL sprzedawcy.
```json
Copy Code{
    "transactionID": "q6Gb8jFT7Ag0UGCTApMM",
    "execution": {
        "startTime": "2025-01-09T16:47:45.754Z",
        "endTime": "2025-01-09T16:47:48.840Z"
    },
    "paymentStatus": "Pending",
    "returnStatus": {
        "statusCode": "000",
        "statusMsg": "Success",
        "statusDescription": "Success"
    },
    "redirectURL": "https://testpay.autopay.eu/web/payment/continue/AX7B553VIB/1BHFTSH9K"
}
```
### Krok 4: Uzyskaj status płatności, aby poznać wynik płatności
Po całkowitym przetworzeniu płatności możesz sprawdzić status swojej transakcji, wysyłając żądanie GET.
Nagłówek HTTP autoryzacji jest ustawiony na token okaziciela, tak jak był używany podczas początkowej realizacji transakcji.
| Operacja | Typ operacji | Metoda działania i punkt końcowy | Opis operacji |
| Uzyskaj status płatności | Połączenie synchroniczne | GET
/api/v1/payment/{transactionId}/status | Uzyskaj status płatności |
| Parametr zapytania | transactionId | Ciąg | Obowiązkowy | Identyfikacja płatności.
Przykład: 9078fbb0-fced-4606-95c7-4989f06ee253 |
Oczekiwana odpowiedź pomyślna:
```json
Copy Code{
    "merchant": {
        "terminalId": "101778",
        "merchantTransactionId": "Order Id: r7cxvi0saj"
    },
    "transactionID": "J120XDzUq2u4UwVDSZBt",
    "amount": {
        "currency": "PLN",
        "value": "50.50"
    },
    "paymentType": "PURS",
    "paymentStatus": "Success",
    "paymentMethod": "PAY_BY_LINK",
    "execution": {
        "endTime": "2023-06-20T10:07:27.771Z",
        "startTime": "2023-06-20T10:07:27.701Z"
    },
    "returnStatus": {
        "statusCode": "000",
        "statusMsg": "Success",
        "statusDescription": "Success"
    }
}
```
Pomyślna odpowiedź techniczna składa się ze statusu HTTP-200 i wartości returnStatus.statusCode=”000″.
Oto kilka przykładów możliwych kodów wyników:
| Kod wyniku | statusMsg | Opis | Akcja |
| HTTP-200 | Sukces | Odpowiedź powodzenia | Nie dotyczy |
| HTTP-400 | Zła prośba | Ładunek JSON nie jest zgodny z definicją API lub brakuje niektórych obowiązkowych nagłówków HTTP. | Sprawdź w API Market poprawną składnię. |
| HTTP-401 | Nieautoryzowany | W przypadku Autoryzacji token okaziciela jest nieprawidłowy/wygasł lub nie jest powiązany z używanym terminalem. | Sprawdź w SIBS Backoffice w sekcji Poświadczenia, czy token jest ważny i w razie potrzeby utwórz nowy. |
| HTTP-403 | Zabroniony | Identyfikator klienta ustawiony w nagłówku HTTP X-IBM-Client-Id jest nieprawidłowy lub nie posiada prawidłowej subskrypcji interfejsu API. | Sprawdź w SIBS Backoffice w SPG APP 2.0, czy ClientID jest poprawny. Jeśli problem będzie się powtarzał, skontaktuj się z pomocą techniczną SIBS Gateway w celu zresetowania ClientID. |
| HTTP-405 | Niedozwolona metoda | Zastosowana metoda HTTP nie jest zgodna z żadną dostępną definicją API. | Sprawdź w API Market poprawną metodę HTTP. |
| HTTP-429 | Zbyt dużo zapytań | Przekroczono limit szybkości wywołań API. | Informacje na temat limitów stawek mających zastosowanie do API można znaleźć w API Market. |
| HTTP-500 | Wewnętrzny błąd serwera | Wywołanie API nie powiodło się… i najprawdopodobniej jest to po naszej stronie. | Powinieneś ponowić operację, a jeśli problem będzie się powtarzał, skontaktuj się z pomocą techniczną SIBS Gateway w celu uzyskania pomocy. |
| HTTP-503 | serwis niedostępny | Wywołanie API nie jest obecnie dostępne. Zwykle jesteśmy zawsze aktywni, ale podczas planowej konserwacji mogą wystąpić krótkie problemy z dostępnością. | Powinieneś poczekać i spróbować ponownie później. |
### On this page:
- Jak to działa
- Krok 1: Uzyskaj listę podmiotów Szybkiego przelewu i przedstaw je klientowi
- Krok 2: Wywołaj API, aby uzyskać Listę Regulacji
- Krok 3: Wywołaj API, aby uzyskać ważny link do płatności dla wybranego podmiotu
- Krok 4: Uzyskaj status płatności, aby poznać wynik płatności
Zamknij ustawienia ciasteczek RODO
- Przegląd prywatności
- Ściśle niezbędne ciasteczka
Ta strona korzysta z ciasteczek, aby zapewnić Ci najlepszą możliwą obsługę. Informacje o ciasteczkach są przechowywane w przeglądarce i wykonują funkcje takie jak rozpoznawanie Cię po powrocie na naszą stronę internetową i pomaganie naszemu zespołowi w zrozumieniu, które sekcje witryny są dla Ciebie najbardziej interesujące i przydatne.
Ściśle niezbędne ciasteczka
Niezbędne ciasteczka powinny być zawsze włączone, abyśmy mogli zapisać twoje preferencje dotyczące ustawień ciasteczek.
Włącz lub wyłącz ciasteczka