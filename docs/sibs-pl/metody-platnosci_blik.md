<!-- Source: https://www.docs.pay.sibs.com/pl/metody-platnosci/blik/ -->
<!-- Scraped: 2026-04-19T14:29:52.182Z -->

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
# BLIK
BLIK to najpopularniejszy system płatności mobilnych w Polsce, oferujący wygodny i bezpieczny sposób płatności. Użytkownicy mogą dokonywać natychmiastowych płatności bezpośrednio z aplikacji bankowej, wprowadzając kod BLIK i potwierdzając transakcję w aplikacji.
Płatność BLIKIEM – przykład desktopowego i mobilnego interfejsu użytkownika.
| Metoda płatności | Kategoria | Kraje | Waluty | Funkcjonalności | Integracje |
| --- | --- | --- | --- | --- | --- |
| BLIK | Bankowość internetowa | Polska | PLN | OneClickCzęściowy zwrot kosztówZwroty kosztówAnulowanieWirtualny Terminal | APIFormularz PłatnościWtyczka PrestashopWtyczka WooCommerceWtyczka Magento |
### Jak korzystać z BLIKa
Po złożeniu zamówienia i wybraniu przez Klienta BLIKa na Twojej stronie:
- Kupujący musi w formularzu płatności podać bezpieczny kod BLIK;
- Otrzymuje ten sześciocyfrowy kod z aplikacji bankowej i wprowadza go na stronie płatności. Kod BLIK traci ważność za 120 sekund;
- Gdy kupujący wybierze opcję Zapłać, BLIK wysyła powiadomienie push do aplikacji bankowej;
- Aby płatność została zrealizowana, kupujący musi potwierdzić płatność w aplikacji bankowej w ciągu 45 sekund.
Sprawdź, jak korzystać z BLIKA OneClick.
### Jak to działa
Zanim zaczniesz, powinieneś utworzyć zlecenie zamówienia z BLIKiem jako metodą płatności.
Następnie należy dokonać zakupu BLIKiem zgodnie z poniższym opisem:
| Środowisko | URL | Metoda działania i endpointy | Opis działania |
| --- | --- | --- | --- |
| PROD | api.sibsgateway.com | POSTapi/v1/payments/:transactionId/blik/purchase | Wykonaj przekierowanie klienta do systemu płatności BLIK w celu pobrania kodu klienta i potwierdzenia płatności. |
| TEST | stargate.qly.site[1|2].sibs.pt | POSTapi/v1/payments/:transactionId/blik/purchase | Wykonaj przekierowanie klienta do systemu płatności BLIK w celu pobrania kodu klienta i potwierdzenia płatności. |
Poniższy komunikat przedstawia płatność BLIK:
Identyfikator ścieżki
Służy do identyfikacji transakcji.
Aplikacja/json.
Podsumowanie autoryzacji.
Obiekt definiujący dodatkowe informacje o transakcji.
Obiekt definiujący informacje o urządzeniu klienta. Nie występuje, jeżeli przedmiot został wysłany w trakcie tworzenia zamówienia.
Ciąg <= 40 znaków
Browser Accept Header
Przeglądarka z włączoną obsługą Java
Język Przeglądarki.
Głębia kolorów przeglądarki.
Wysokość ekranu przeglądarki.
Szerokość ekranu przeglądarki
Strefa czasowa przeglądarki
Agent użytkownika przeglądarki.
Rodzina systemowa
Wesja systemu.
architektura systemu
Producent urządzenia.
Model urządzenia.
Unikalny identyfikator urządzenia
Ciąg <=40 znaków
Nazwa aplikacji.
Wersja aplikacji.
Geolokalizacja.
Tablica krotek wartości klucza.
Kod BLIKA. Z 6-cyfrowym wzorem. Obowiązkowe przy zakupie BLIKIEM. Nie występuje, jeżeli w żądaniu podana jest wartość tokena (dla Zakupu BLIK One Click).
Oto przykład zakupu BLIKiem:
```json
Copy Codehttps://stargate.qly.site1.sibs.pt/api/v1/payments/{transactionID}/blik/purchase
```
```json
Copy CodeAuthorization: Digest {transactionSignature}
X-IBM-Client-Id: b4480347-9fc8-4790-b359-100a99c60ea3
Content-Type: application/json
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
            "browserUserAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36"
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
    "merchant": {
        "merchantURL": "https://www.pay.sibs.com/eng/documentation/sibs-gateway-3//integration/server-to-server/blik/"
    },
    "BLIKCode": "777001"
}
```
Do celów testowych wszystkie 6-cyfrowe kody BLIK zaczynające się od 777 (np. 777001) są ważne. Kody są współdzielone, więc jeśli któryś z nich jest tymczasowo nieważny, wybierz inną sekwencję zaczynającą się od 777.
Po zakończeniu operacji zakupu powinieneś otrzymać status oczekującej płatności.
Poniższa wiadomość stanowi odpowiedź otrzymaną od naszego serwera.
```json
Copy Code{
    "transactionID": "83GdUDUv2ykTTJUzsB9G",
    "execution": {
        "startTime": "2023-06-20T09:20:02.862Z",
        "endTime": "2023-06-20T09:20:05.048Z"
    },
    "paymentStatus": "Pending",
    "returnStatus": {
        "statusCode": "000",
        "statusMsg": "Success",
        "statusDescription": "Success"
    },
    "actionResponse": {
        "data": {
            "params": []
        }
    }
}
```
Aby uzyskać najnowszą aktualizację, należy następnie wykonać operację „Pobierz status”.
Nagłówek HTTP autoryzacji jest ustawiony na token okaziciela, tak jak był używany podczas początkowej realizacji transakcji.
```json
Copy CodeGET {transactionID}/status
```
```json
Copy Codehttps://stargate.qly.site1.sibs.pt/api/v1/payments/{transactionID}/status
```
```json
Copy CodeAuthorization: ‘Bearer <AuthToken>’
X-IBM-Client-Id: ‘<ClientId>’
Content-Type: application/json
```
Pomyślna odpowiedź techniczna składa się ze statusu HTTP-200 i returnStatus.statusCode=”000„.
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
- Jak korzystać z BLIKa
- Jak to działa
Zamknij ustawienia ciasteczek RODO
- Przegląd prywatności
- Ściśle niezbędne ciasteczka
Ta strona korzysta z ciasteczek, aby zapewnić Ci najlepszą możliwą obsługę. Informacje o ciasteczkach są przechowywane w przeglądarce i wykonują funkcje takie jak rozpoznawanie Cię po powrocie na naszą stronę internetową i pomaganie naszemu zespołowi w zrozumieniu, które sekcje witryny są dla Ciebie najbardziej interesujące i przydatne.
Ściśle niezbędne ciasteczka
Niezbędne ciasteczka powinny być zawsze włączone, abyśmy mogli zapisać twoje preferencje dotyczące ustawień ciasteczek.
Włącz lub wyłącz ciasteczka