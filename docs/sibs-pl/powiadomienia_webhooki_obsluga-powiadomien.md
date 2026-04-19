<!-- Source: https://www.docs.pay.sibs.com/pl/powiadomienia/webhooki/obsluga-powiadomien/ -->

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
# Obsługa powiadomień
Webhook to API, który dostarcza w czasie rzeczywistym informacje dotyczące zmian w statusie płatności transakcji.
Sprzedawcy mogą otrzymywać powiadomienia drogą elektroniczną lub za pośrednictwem punktu końcowego (powiadomienie zmontowane dla zapytania o status – Checkout Status). Dla każdej transakcji zostanie jednak wysłane tylko jedno powiadomienie.
Powiadomienia są wysyłane bezpośrednio do punktu końcowego (URL) skonfigurowanego przez sprzedawcę. Parametryzacja tego punktu końcowego musi być wykonana w SIBS BackOffice.
Za każdym razem, gdy SIBS Gateway otrzyma aktualizację statusu płatności transakcji, zostanie wysłane powiadomienie z nowym statusem płatności transakcji.
Każdego dnia SIBS Gateway wysyła podsumowującą wiadomość e-mail z najnowszymi nieudanymi powiadomieniami (wiadomość e-mail musi być zarejestrowana w SIBS BackOffice).
Nie ma gwarancji co do kolejności wiadomości, zwłaszcza jeśli różnica czasu między powiadomieniami jest mniejsza niż czas potrzebny na ich przetworzenie lub z powodu jakichkolwiek problemów komunikacyjnych lub systemowych. Gdy problemy zostaną rozwiązane, nowe powiadomienia będą przychodzić w czasie rzeczywistym, a stare będą wysyłane ponownie. Jeśli nie otrzymano żadnego powiadomienia, przed odrzuceniem jakiejkolwiek transakcji należy skorzystać z opcji „Status realizacji transakcji”.
Powiadomienia są wysyłane jako wywołania zwrotne HTTPS (webhooks) do punktu końcowego na serwerze. Upewnij się, że posiadasz ważny łańcuch certyfikatów SSL. Certyfikaty z podpisem własnym nie są ważne.
### Jak to działa?
Do otrzymywania powiadomień potrzebny jest serwer, który posiada następujące funkcje:
- Punkt końcowy (Endpoint) zdolny do odbierania żądań HTTP POST.
- Otwarty port TCP dla ruchu HTTPS (port 443 lub 80) z szyfrowaniem TLSv1.2.
W zależności od sieci i wymagań bezpieczeństwa może być również konieczne umieszczenie naszej sieci na białej liście zapory sieciowej. Aby upewnić się, że serwer poprawnie obsługuje powiadomienia, wymagamy potwierdzenia każdego typu powiadomienia za pomocą HTTP 200 i odpowiedzi zawierającej:
```json
Copy Code{
      "statusCode": "200",
      "statusMsg": "Success",
      "notificationID": "2533e456-5e36-42c8-9eea-7961902f185e"
}
```
Gdy serwer otrzyma powiadomienie, powinien:
- odszyfrować powiadomienie
- przechować powiadomienie w bazie danych
- potwierdzić powiadomienie za pomocą HTTP 200 OK, jak wyjaśniono wcześniej.
### Deszyfrowanie
Treść powiadomienia jest szyfrowana w celu ochrony danych przed próbami oszustwa. Konwertując ciąg znaków czytelny dla człowieka na format szesnastkowy, używamy UTF-8.
- Algorytm szyfrowania: AES
- Tryb blokowy: GCM
- Wypełnienie: None
- Wektor inicjalizacji: w nagłówku HTTP (X-Initialization-Vector)
- Znacznik uwierzytelniania : W nagłówku HTTP (X-Authentication-Tag)
- Format treści: Base64
- Format wektora inicjalizacji: Base64
```json
Copy CodeSecret: O0Bur9uhZkS54NkwFhVyeutED6DhLbOQUBDt3i3W/C4=
X-Authentication-Tag: Ytw9bzOS1pXqizAKMGXVQ==
Content-Type: text/plain
X-Initialization-Vector: Ldo3OyWNgRchSF3C
```
```json
Copy CodeWgErmJOV6wg3BuRkrgZLUUnh57BYzhIzvBFdpadHRsc43UcjtZEevRGDIDu3YxocXMXe8O+xQpMRxwTJPv766IaNqUiUEjAIjZSMEYCZ0pBursUYB+9nB4eqNUiAS2MJ9sR+Cj2iBf6G6KXLfp9K6dK7c0UED5XrJwbovY8X8pMyxktFTEaflp0e76ZywsCQvtqEtqNz9uYEyqmAANbsBwbwyWpkCC8H1kZN2fV3CYetW1CTPmWdPp3C18Yfh826NN4XlKu1VmUmea70PyjmRKSsjPXpfrRX8udelVIK2WTFtnRxD4x588d1nlGY5D5DQmJ8KYZzfvjTmDXGAPiRIEGuXp8h6rBQXS8P/m1llBtboGgQv4MmW3zvq0G6KFlYIcM=
```
```json
Copy Code{
  "returnStatus": {
    "statusMsg": "Success",
    "statusCode": "000"
  },
  "paymentStatus": "Success",
  "paymentMethod": "CARD",
  "transactionID": "WebhookTest",
  "amount": {
    "currency": "EUR",
    "value": 10.0
  },
  "merchant": {
    "terminalId": 1000000
  },
  "paymentType": "PURS",
  "notificationID": "f153c248-e7be-4c12-8d88-6c9f1f3b83e4"
}
```
Poniżej znajduje się kilka przykładów pokazujących, jak odszyfrować powiadomienie webhook:
- C#
- Java
- PHP
- Python
```json
Copy Codeusing System;
using System.Security.Cryptography;
using System.Text; public static class Program {public static void Main() {byte[] secret = System.Convert.FromBase64String("6fNDiYU0T0/evFpmfycNai/AqF24i+rT0OmuVw0/sGQ=");byte[] ciphertext = System.Convert.FromBase64String("9bIjURJIcwoKvQr+ifOTH3HbMX+IqmsRqHuG/I1GfbSX89JE5DcWh/p8QROC5pRAuYZ7"+"ln7RSkHXJdZpVz1LFQ2859WsetvHHui7qYmfxATOO1j0AQuPdAD3FeRH0kR4s/v3c2nV8"+"1DnUXFCnQER/+VWrYdbu5vn8gm+diSE6CHvkK+ODy0ebVi5O6VBnWVjgBUG33VwWiAyIl"+"7Ik435V55WnZgynH3GfbVYoGwZ5UhYtn3yw2yruiLAKu6VTBvnh/ZJP21cHCJSF6NPSd+8"+"1gzWFU/+ECm3cf3uBbCkmKmL7HxRhRxhG0lMtX6ELZOXuw3eDJ1BTu+sSMkV/5Xk+5XX48"+"XmP6CGZ7KmP7Q3Fw1kZmhn0unFyv0Gw8PjT1Ohny/HMgNl16I=");byte[] nonce = System.Convert.FromBase64String("RYjpCMtUmK54T6Lk");byte[] tag = System.Convert.FromBase64String("FUajWHmZjP4A5qaa1G0kxw==");using (var aes = new AesGcm(secret))

		{var plaintextBytes = new byte[ciphertext.Length];

aes.Decrypt(nonce, ciphertext, tag, plaintextBytes);string decrypt = Encoding.UTF8.GetString(plaintextBytes);

			Console.WriteLine(decrypt);
		}
	}
}
```
```json
Copy Codeimport java.security.Security;
import java.util.Base64;import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;import com.google.common.base.Charsets;import org.apache.commons.lang3.ArrayUtils;
import org.bouncycastle.jce.provider.BouncyCastleProvider;// For Java and JVM-based languages, you might need to install unrestricted policy file for JVM,
// which is provided by Sun. Please refer BouncyCastle FAQ if you get
// java.lang.SecurityException: Unsupported keysize or algorithm parameters or
// java.security.InvalidKeyException: Illegal key size.

// If you cannot install unrestricted policy file for JVM because of some reason, you can try with reflection: See here.public class Test {public static void main(String[] args) {try {
 Security.addProvider(new BouncyCastleProvider());// Data from configuration String keyFromConfiguration = "6fNDiYU0T0/evFpmfycNai/AqF24i+rT0OmuVw0/sGQ=";// Data from server String ivFromHttpHeader = "RYjpCMtUmK54T6Lk";String authTagFromHttpHeader = "FUajWHmZjP4A5qaa1G0kxw==";String httpBody = "9bIjURJIcwoKvQr+ifOTH3HbMX+IqmsRqHuG/I1GfbSX89JE5DcWh/p8QROC5pRAuYZ7"
+"ln7RSkHXJdZpVz1LFQ2859WsetvHHui7qYmfxATOO1j0AQuPdAD3FeRH0kR4s/v3c2nV8"
+"1DnUXFCnQER/+VWrYdbu5vn8gm+diSE6CHvkK+ODy0ebVi5O6VBnWVjgBUG33VwWiAyIl"
+"7Ik435V55WnZgynH3GfbVYoGwZ5UhYtn3yw2yruiLAKu6VTBvnh/ZJP21cHCJSF6NPSd+8"
+"1gzWFU/+ECm3cf3uBbCkmKmL7HxRhRxhG0lMtX6ELZOXuw3eDJ1BTu+sSMkV/5Xk+5XX48"
+"XmP6CGZ7KmP7Q3Fw1kZmhn0unFyv0Gw8PjT1Ohny/HMgNl16I=";// Convert data to process byte[] key = Base64.getDecoder().decode(keyFromConfiguration);byte[] iv = Base64.getDecoder().decode(ivFromHttpHeader);byte[] authTag = Base64.getDecoder().decode(authTagFromHttpHeader);byte[] encryptedText = Base64.getDecoder().decode(httpBody);// Unlike other programming language, We have to append auth tag at the end of
 // encrypted text in Java byte[] cipherText = ArrayUtils.addAll(encryptedText, authTag);// Prepare decryption SecretKeySpec keySpec = new SecretKeySpec(key, 0, 32, "AES");Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
 cipher.init(Cipher.DECRYPT_MODE, keySpec, new IvParameterSpec(iv));
// Decrypt byte[] bytes = cipher.doFinal(cipherText);
 System.out.println(new String(bytes, Charsets.UTF_8));

 } catch (Exception e) {
 e.printStackTrace();
 }
 }
}
```
```json
Copy Codefunction sodium_decrypt( $webhookSecret, $iv_from_http_header, $http_body , $auth_tag_from_http_header ){$key = mb_convert_encoding($webhookSecret, "UTF-8", "BASE64");$iv = mb_convert_encoding($iv_from_http_header, "UTF-8", "BASE64");$cipher_text = mb_convert_encoding($http_body, "UTF-8", "BASE64") . mb_convert_encoding($auth_tag_from_http_header, "UTF-8", "BASE64");$result = sodium_crypto_aead_aes256gcm_decrypt($cipher_text, "", $iv, $key);return $result;

}$webhookSecret = "6fNDiYU0T0/evFpmfycNai/AqF24i+rT0OmuVw0/sGQ=";
$iv_from_http_header = "RYjpCMtUmK54T6Lk";
$auth_tag_from_http_header = "FUajWHmZjP4A5qaa1G0kxw==";
$http_body = "9bIjURJIcwoKvQr+ifOTH3HbMX+IqmsRqHuG/I1GfbSX89JE5DcWh/p8QROC5pRAuYZ7" .
"ln7RSkHXJdZpVz1LFQ2859WsetvHHui7qYmfxATOO1j0AQuPdAD3FeRH0kR4s/v3c2nV8" .
"1DnUXFCnQER/+VWrYdbu5vn8gm+diSE6CHvkK+ODy0ebVi5O6VBnWVjgBUG33VwWiAyIl" .
"7Ik435V55WnZgynH3GfbVYoGwZ5UhYtn3yw2yruiLAKu6VTBvnh/ZJP21cHCJSF6NPSd+8" .
"1gzWFU/+ECm3cf3uBbCkmKmL7HxRhRxhG0lMtX6ELZOXuw3eDJ1BTu+sSMkV/5Xk+5XX48" .
"XmP6CGZ7KmP7Q3Fw1kZmhn0unFyv0Gw8PjT1Ohny/HMgNl16I=";// Decrypt message
$result = sodium_decrypt($webhookSecret, $iv_from_http_header, $http_body , $auth_tag_from_http_header);print($result);
```
```json
Copy Codeimport base64
from Cryptodome.Cipher import AES def decrypt_AES_GCM(encryptedMsg, authTag, secretKey, iv):
 iv = base64.b64decode(iv)
 encryptedMsg = base64.b64decode(encryptedMsg)
 secretKey = base64.b64decode(secretKey)
 authTag = base64.b64decode(authTag)
 aesCipher = AES.new(secretKey, AES.MODE_GCM, iv)
 plaintext = aesCipher.decrypt_and_verify(encryptedMsg, authTag)return plaintext

 example = {"encoded" : "9bIjURJIcwoKvQr+ifOTH3HbMX+IqmsRqHuG/I1GfbSX89JE5DcWh/p8QROC5pRAuYZ7" \
"ln7RSkHXJdZpVz1LFQ2859WsetvHHui7qYmfxATOO1j0AQuPdAD3FeRH0kR4s/v3c2nV8" \
"1DnUXFCnQER/+VWrYdbu5vn8gm+diSE6CHvkK+ODy0ebVi5O6VBnWVjgBUG33VwWiAyIl" \
"7Ik435V55WnZgynH3GfbVYoGwZ5UhYtn3yw2yruiLAKu6VTBvnh/ZJP21cHCJSF6NPSd+8" \
"1gzWFU/+ECm3cf3uBbCkmKmL7HxRhRxhG0lMtX6ELZOXuw3eDJ1BTu+sSMkV/5Xk+5XX48"
"XmP6CGZ7KmP7Q3Fw1kZmhn0unFyv0Gw8PjT1Ohny/HMgNl16I=","iv" : "RYjpCMtUmK54T6Lk","tag" : "FUajWHmZjP4A5qaa1G0kxw==","secret" : "6fNDiYU0T0/evFpmfycNai/AqF24i+rT0OmuVw0/sGQ="}


result = decrypt_AES_GCM(example['encoded'], example['tag'], example['secret'], example['iv'])
print(result)
```
### On this page:
- Jak to działa?
- Deszyfrowanie
- Przegląd prywatności
- Ściśle niezbędne ciasteczka
Ta strona korzysta z ciasteczek, aby zapewnić Ci najlepszą możliwą obsługę. Informacje o ciasteczkach są przechowywane w przeglądarce i wykonują funkcje takie jak rozpoznawanie Cię po powrocie na naszą stronę internetową i pomaganie naszemu zespołowi w zrozumieniu, które sekcje witryny są dla Ciebie najbardziej interesujące i przydatne.
Niezbędne ciasteczka powinny być zawsze włączone, abyśmy mogli zapisać twoje preferencje dotyczące ustawień ciasteczek.