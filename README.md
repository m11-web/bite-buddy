# Bite Buddy

Step 1: Location Detection & Manual City Selection Page ka Prompt

AI ko pehla yeh prompt dein taake woh homepage banaye jahan location permission ya city selection ka option ho:

"Mujhe ek HTML, CSS aur JavaScript ka homepage code likh kar do jo ek fast food brand 'Spicy Bite' ke liye ho. Jab user website khole, toh aik pop-up ya button aaye jo browser ki Geolocation API ke zariye user ki current location ki permission mange. Agar user permission de de, toh nearest branch detect karne ka logic ho. Agar permission na mile ya user deny kare, toh aik manual dropdown page khul jaye jahan user apni city select kar sake (jaise Multan, Lahore, Islamabad, etc.). Design dark aur red fast-food theme mein hona chahiye."

Step 2: Branch-Wise Menu aur Products Page ka Prompt

Jab city ya branch select ho jaye, toh us branch ke products dikhane ke liye yeh prompt dein:

"Mujhe JavaScript aur HTML/CSS ka code chahiye jo selected branch ke mutabiq products show kare. Farz karein hamare paاس ek JavaScript object ya array hai jisme branches (jaise Multan Branch, Lahore Branch) aur unke apne menu items (Pizzas, Burgers, Fries with prices) hain. Jab user apni branch select kare, toh sirf ussi branch ke items aur prices screen par show hon, aur sath mein ek 'Add to Cart' ka button ho."

Step 3: Cart aur Checkout System ka Prompt

Items ko cart mein dalne aur order place karne ke liye yeh prompt use karein:

"Mujhe e-commerce style ka cart aur checkout system JavaScript mein likh kar do. Jab user menu se items 'Add to Cart' kare, toh side drawer ya cart page par total bill calculate ho kar dikhe. Checkout form mein user ka Naam, Phone Number, aur Delivery Address ka input ho. Order place hone par aik unique Order ID generate ho aur data local storage ya backend ke liye prepare ho jaye."

Step 4: Multi-User Login & Dashboard System (Admin, Manager, Driver) ka Prompt

Sabse main hissa, jahan har role ka alag dashboard ho:

"Mujhe ek multi-user login aur dashboard system ka code likh kar do (HTML, CSS, JavaScript). Isme 3 tarah ke roles honge: 1. Admin (jo sab kuch dekh sake), 2. Branch Manager (jo sirf apni branch ke aane wale orders dekh aur manage kar sake, jaise status 'Preparing' karna), aur 3. Delivery Driver/Rider (jo apna account login kar ke dekh sake ke usey kis address par order deliver karna hai aur status 'Delivered' update kar sake). Inke liye login page aur mukhtalif dashboard views ka code do."

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/850393df-ee8e-4270-a49d-3102425a40d4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
