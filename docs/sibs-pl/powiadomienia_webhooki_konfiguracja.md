<!-- Source: https://www.docs.pay.sibs.com/pl/powiadomienia/webhooki/konfiguracja/ -->

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
# Konfiguracja
Skorzystaj z SIBS Backoffice, aby utworzyć webhook i być na bieżąco z płatnościami. Postępuj zgodnie z kolejnymi krokami i wybierz odpowiednie opcje, które odpowiadają żądanym aktualizacjom.
Aby skorzystać z tej funkcji, można łatwo skonfigurować webhook do otrzymywania powiadomień o zdarzeniach na koncie. Pozwoli Ci to być na bieżąco i podejmować odpowiednie działania w razie potrzeby.
W menu „Webhooks” można wyświetlić listę wszystkich webhooków. Możesz szybko zastosować filtry według poświadczeń, powiadomień, typu i webhooków (e-mail lub URL).
Po kliknięciu ikony Webhook, mogą zostać wyświetlone dwie opcje w zależności od typu elementu webhook. Jeśli webhook jest typu URL, można uzyskać dostęp do jego szczegółów i przetestować go. Jeśli webhook jest typu e-mail, można wyświetlić tylko jego szczegóły.
### Dodaj nowy Webhook
Aby utworzyć nowy webhook, należy kliknąć przycisk „Dodaj nowy webhook”. Następnie zostanie przedstawiony zestaw kroków, które pomogą w wypełnieniu danych niezbędnych do utworzenia elementu webhook. Poniższe obrazy przedstawiają przykład tworzenia elementu webhook typu URL.
Jeśli chodzi o dostarczanie powiadomień, webhook dla adresu URL wysyła dane w czasie rzeczywistym, wysyłając żądanie HTTP do określonego punktu końcowego, podczas gdy webhook dla wiadomości e-mail dostarcza powiadomienia, wysyłając je jako wiadomości e-mail na wskazany adres e-mail.
Webhooki można zdefiniować dla sprzedawcy, sklepu lub terminala. Jeśli są one zdefiniowane dla sprzedawcy, będą miały zastosowanie do wszystkich sklepów i terminali w nim zawartych.
Definiowanie webhooków dla sklepu dotyczy tylko terminali w tym sklepie.
Jeśli chcesz zdefiniować webhook dla konkretnego terminala, powinieneś wybrać tę opcję.
Po wypełnieniu wszystkich wymaganych danych można kliknąć przycisk “Utwórz webhook”, aby utworzyć webhook.
### Usuwanie Webhooków
Jeśli masz uprawnienia do zarządzania webhookami, możesz usuwać powiadomienia, które nie są już potrzebne. Aby to zrobić, należy kliknąć opcję „Usuń” znajdującą się w prawym górnym rogu strony szczegółów webhooka. Po jej kliknięciu wyświetlone zostanie wyskakujące okienko z potwierdzeniem operacji i będzie można usunąć webhook.
### Test Webhooków
Możesz łatwo przetestować webhook, o ile jest on typu URL. Aby to zrobić, wystarczy kliknąć przycisk „Test”, a zostaniesz przekierowany na stronę testowania webhooka. Kliknij przycisk testowy i poczekaj na pomyślne zakończenie żądania. Następnie zostanie wyświetlone wysłane powiadomienie, potwierdzające, że webhook działa poprawnie.
### Szczegóły Webhooka
Aby wyświetlić wszystkie szczegóły webhooka, należy kliknąć opcję „Szczegóły”. Zapewni to bardziej szczegółowy widok danych webhooka. Jeśli chcesz wprowadzić jakiekolwiek zmiany, wystarczy że klikniesz ikonę ołówka, aby edytować informacje. Po zaktualizowaniu danych kliknij ikonę, aby upewnić się, że nowe informacje zostały zapisane.
### On this page:
- Dodaj nowy Webhook
- Usuwanie Webhooków
- Test Webhooków
- Szczegóły Webhooka
- Przegląd prywatności
- Ściśle niezbędne ciasteczka
Ta strona korzysta z ciasteczek, aby zapewnić Ci najlepszą możliwą obsługę. Informacje o ciasteczkach są przechowywane w przeglądarce i wykonują funkcje takie jak rozpoznawanie Cię po powrocie na naszą stronę internetową i pomaganie naszemu zespołowi w zrozumieniu, które sekcje witryny są dla Ciebie najbardziej interesujące i przydatne.
Niezbędne ciasteczka powinny być zawsze włączone, abyśmy mogli zapisać twoje preferencje dotyczące ustawień ciasteczek.