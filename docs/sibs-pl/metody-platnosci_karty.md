<!-- Source: https://www.docs.pay.sibs.com/pl/metody-platnosci/karty/ -->
<!-- Scraped: 2026-04-19T14:29:45.791Z -->

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
# Karty płatnicze
Płatności kartami są dostępne dla kart Visa, Mastercard i kart co-branded, a ponieważ przykład użycia może się nieznacznie różnić w zależności od konkretnego przypadku, dlatego w tej sekcji opiszemy jednorazowy zakup, ale możesz także mieć dostęp do kilka różnych przypadków użycia.
Płatność kartą – przykład desktopowego i mobilnego interfejsu użytkownika.
Oprócz kart Visa i Mastercard, SIBS Gateway obsługuje także karty marek partnerskich, takie jak Cartes Bancaires.
Autoryzacja płatności z uwierzytelnianiem 3DSecure (bezproblemowa lub kwestionowana).
Zapisz dane kupującego i dokonuj płatności cyklicznych i abonamentowych.
Aktywuj najprostszy i najszybszy sposób akceptowania płatności.
Bądź na bieżąco ze zmianami statusów płatności.
Skorzystaj z transakcji zakupu jednorazowego, jeśli chcesz natychmiast obciążyć kupującego opłatą.
| Metoda płatności | Kategoria | Kraje | Waluty | Funkcjonalności | Integracje |
| --- | --- | --- | --- | --- | --- |
| Karta | Karty kredytowe i debetowe | Czechy, Estonia, Francja, Niemcy, Węgry, Portugalia, Polska, Rumunia, Słowacja | CZK, EUR, HUF, PLN, RON | 3D SecureOneClick/Bez koduWstępnie autoryzowane przechwytywanieZakup jednorazowyCzęściowe przechwytywanieCzęściowy zwrot kosztówSubscrypcjeZwrot kosztówAnulowanieWirtualny Terminal | APIFormularz PłatnościWtyczka PrestashopWtyczka WooCommerceWtyczka Magento |
### Jednorazowy zakup
Sprawdź poniżej dostępne środowiska, w których możesz wykonać żądanie POST między serwerami w celu wygenerowania transakcji.
| Środowisko | URL | Metoda działania i punkt końcowy | Opis operacji |
| --- | --- | --- | --- |
| PROD | api.sibsgateway.com | POST version-id/{id}/card/purchase | Żąda płatności zarejestrowanej przy poprzedniej transakcji przy użyciu danych karty wprowadzonych przez klienta. |
| TEST | stargate.qly.site[1|2].sibs.pt | POSTapi/v1/payments/:transactionId/card/purchase | Żąda płatności zarejestrowanej przy poprzedniej transakcji przy użyciu danych karty wprowadzonych przez klienta. |
### Zanim dokonasz płatności
Upewnij się, że zamówienie zostało utworzone i przesłane.
- Żądanie wymaga nagłówka autoryzacji z podpisem transakcji zwróconym w odpowiedzi na utworzenie zamówienia.
W tym żądaniu Bearer Token zostaje zastąpiony przez odpowiedź checkoutu transactionSignature.
Poniższy komunikat przedstawia jednorazowy zakup, w przypadku którego płatność jest realizowana natychmiastowo i nie są identyfikowane żadne dodatkowe usługi (3D Secure, Tokenizacja i Karta OneClick) do połączenia.
Identyfikator ścieżki
Element do zapytania o status transakcji według identyfikatora transakcji.
application/json
Bearer Token. Based on OAuth2 authentication performed in a pre-step.
Token that identifies a client organization. It is provided during onboarding process and must be used in every call.
Object that defines the payment operation request fields.
string <= 40 characters
The Primary Account Number (credit card number).
The security code (CVV/CVC) associated with the credit card.
ISODateTime
The expiration date of the credit card.
The name of the cardholder as it appears on the credit card.
A flag indicating whether to create a token for future use or not (true/false).
Oto przykład, jak dokonać jednorazowego zakupu:
```json
Copy Code{
    "cardInfo": {
        "PAN": "5236410030000927",
        "secureCode": "776",
        "validationDate": "2026-05-26T00:00:00.000Z",
        "cardholderName": "Jane Smith",
        "createToken": false
    }
}
```
### Co dalej?
Zapoznaj się z innymi funkcjami płatności kartą, z których możesz skorzystać.
- Płatność ze wstępnie autoryzowanym i późniejszym przechwytywaniem w przypadku, gdy pobierasz opłatę (całkowitą lub częściową) dopiero w momencie dostarczenia zamówienia.
- Autoryzacja płatności z autentykacją 3D Secure.
- Płatność w oparciu o tokenizację karty.
- Płatność w oparciu o Kartę OneClick.
Po dokonaniu płatności otrzymasz odpowiedź zawierającą w wiadomości status płatności. Informuje on, czy transakcja została zaakceptowana, odrzucona, nadal oczekuje na ostateczny wynik lub wymaga dodatkowych działań.
- Sukces: zakup został pomyślnie przetworzony, a klient został obciążony.
- Odrzucony: zakup został odrzucony.
- Oczekuje: Ostateczny wynik zakupu nie jest jeszcze znany. Będziesz musiał pytać o status tej transakcji, aż osiągnie ona stan ostateczny lub zdecydujesz się ją anulować.
- Częściowy: zakup został częściowo zaakceptowany, ale do jego zakończenia wymagane są dodatkowe działania (np. uwierzytelnienie 3D-Secure). Element actionResponse zawiera instrukcje dotyczące dalszego postępowania.
### Uzyskaj status płatności
Następnie, po przetworzeniu płatności, możesz sprawdzić status swojej transakcji, wysyłając żądanie GET.
Nagłówek HTTP autoryzacji jest ustawiony na token okaziciela, tak jak był używany podczas początkowej realizacji transakcji.
```json
Copy Codehttps://stargate.qly.site1.sibs.pt/api/v1/payments/{transactionID}/status
```
```json
Copy CodeAutorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6I (...)
X-IBM-Client-Id: b4480347-9fc8-4790-b359-100a99c60ea3
Content-Type: application/json
```
Pomyślna odpowiedź techniczna składa się ze statusu HTTP-200 i returnStatus.statusCode=”000″.
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
- Jednorazowy zakup
- Zanim dokonasz płatności
- Co dalej?
- Uzyskaj status płatności
Zamknij ustawienia ciasteczek RODO
- Przegląd prywatności
- Ściśle niezbędne ciasteczka
Ta strona korzysta z ciasteczek, aby zapewnić Ci najlepszą możliwą obsługę. Informacje o ciasteczkach są przechowywane w przeglądarce i wykonują funkcje takie jak rozpoznawanie Cię po powrocie na naszą stronę internetową i pomaganie naszemu zespołowi w zrozumieniu, które sekcje witryny są dla Ciebie najbardziej interesujące i przydatne.
Ściśle niezbędne ciasteczka
Niezbędne ciasteczka powinny być zawsze włączone, abyśmy mogli zapisać twoje preferencje dotyczące ustawień ciasteczek.
Włącz lub wyłącz ciasteczka