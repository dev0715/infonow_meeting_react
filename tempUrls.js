

let urlOne = "http://192.168.10.104:3000/ec88d736-c5ec-4d3a-981b-1991b6ce7c9f/JWT%20eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3YWZkZmE1Ni04MTdiLTQzNjctYjhkYi1hMDcxYjEyNTNhZDIiLCJpYXQiOjE2MjM1OTgzMjYsImV4cCI6MTYyMzc3MTEyNn0.DZwuPYH6wxSeX7D88nlF-oEVxuP5hcAgJ0GC7_wA96Q"


let urlTwo = "http://192.168.10.104:3000/ec88d736-c5ec-4d3a-981b-1991b6ce7c9f/JWT%20eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NzcxMzIzNi1jYjM3LTRlYzktOTEwNy05ZjQ2M2Q5MzBjMjkiLCJpYXQiOjE2MjM1OTg4MjIsImV4cCI6MTYyMzc3MTYyMn0.wd5Cc4wztfmoBNgkqV2FXQOlHRwGjI1UCTnVp8RhuVI"


let url1 = "https://meet.meditati.ro/ec88d736-c5ec-4d3a-981b-1991b6ce7c9f/JWT%20eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfdXNlcklkIjo2LCJ1c2VySWQiOiI3YWZkZmE1Ni04MTdiLTQzNjctYjhkYi1hMDcxYjEyNTNhZDIiLCJuYW1lIjoidGVzdFRlYWNoZXIiLCJlbWFpbCI6InRlYWNoZXJAbWFpbC5jb20iLCJjcmVhdGVkQXQiOiIyMDIxLTA1LTIwVDA3OjQ4OjA0LjAwMFoiLCJ1cGRhdGVkQXQiOiIyMDIxLTA1LTIwVDA3OjQ4OjA0LjAwMFoiLCJyb2xlSWQiOiJ0ZWFjaGVyIiwicm9sZSI6eyJyb2xlSWQiOiJ0ZWFjaGVyIiwicm9sZU5hbWUiOiJUZWFjaGVyIiwiY3JlYXRlZEF0IjoiMjAyMS0wNS0yMFQwNzo0MTozNC4wMDBaIiwidXBkYXRlZEF0IjoiMjAyMS0wNS0yMFQwNzo0MTozNC4wMDBaIn0sInN0dWRlbnQiOnsic3R1ZGVudElkIjpudWxsLCJ0ZWFjaGVySWQiOm51bGwsInN0YXR1cyI6bnVsbCwiY3JlYXRlZEF0IjpudWxsLCJ1cGRhdGVkQXQiOm51bGwsInRlYWNoZXIiOnsidGVhY2hlcklkIjpudWxsLCJzdGF0dXMiOm51bGwsImNyZWF0ZWRBdCI6bnVsbCwidXBkYXRlZEF0IjpudWxsLCJ1c2VyIjp7Il91c2VySWQiOm51bGwsInVzZXJJZCI6bnVsbCwibmFtZSI6bnVsbCwiZW1haWwiOm51bGwsInBhc3N3b3JkIjpudWxsLCJjcmVhdGVkQXQiOm51bGwsInVwZGF0ZWRBdCI6bnVsbCwicm9sZUlkIjpudWxsfX19LCJpYXQiOjE2MjE1MDgyMjYsImV4cCI6MjIyNjMwODIyNn0.IriG-RA1Ext7QEn7JsBKTkJiRYL0_VWVoDrL_qJWlWU";
let url2 = "https://meet.meditati.ro/ec88d736-c5ec-4d3a-981b-1991b6ce7c9f/JWT%20eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfdXNlcklkIjo3LCJ1c2VySWQiOiI2ODYzMzY2Mi04OGJiLTRkZDAtOTlmYS0xZGMzNWQ2MDg0MmUiLCJuYW1lIjoidGVzdFN0dWRlbnROZXciLCJlbWFpbCI6InN0dWRlbnQyQG1haWwuY29tIiwiY3JlYXRlZEF0IjoiMjAyMS0wNS0yMFQwNzo1Mjo0Ni4wMDBaIiwidXBkYXRlZEF0IjoiMjAyMS0wNS0yMFQwNzo1Mjo0Ni4wMDBaIiwicm9sZUlkIjoic3R1ZGVudCIsInJvbGUiOnsicm9sZUlkIjoic3R1ZGVudCIsInJvbGVOYW1lIjoiU3R1ZGVudCIsImNyZWF0ZWRBdCI6IjIwMjEtMDUtMjBUMDc6NDE6MzQuMDAwWiIsInVwZGF0ZWRBdCI6IjIwMjEtMDUtMjBUMDc6NDE6MzQuMDAwWiJ9LCJzdHVkZW50Ijp7InN0dWRlbnRJZCI6NywidGVhY2hlcklkIjo2LCJzdGF0dXMiOiJhY3RpdmUiLCJjcmVhdGVkQXQiOiIyMDIxLTA1LTIwVDA3OjUyOjQ2LjAwMFoiLCJ1cGRhdGVkQXQiOiIyMDIxLTA1LTIwVDA3OjU1OjM2LjAwMFoiLCJ0ZWFjaGVyIjp7InRlYWNoZXJJZCI6Niwic3RhdHVzIjoiYXBwcm92ZWQiLCJjcmVhdGVkQXQiOiIyMDIxLTA1LTIwVDA3OjQ4OjA0LjAwMFoiLCJ1cGRhdGVkQXQiOiIyMDIxLTA1LTIxVDA3OjIxOjIwLjAwMFoiLCJ1c2VyIjp7Il91c2VySWQiOjYsInVzZXJJZCI6IjdhZmRmYTU2LTgxN2ItNDM2Ny1iOGRiLWEwNzFiMTI1M2FkMiIsIm5hbWUiOiJ0ZXN0VGVhY2hlciIsImVtYWlsIjoidGVhY2hlckBtYWlsLmNvbSIsInBhc3N3b3JkIjoiJDJiJDEwJG9tSkVlWG1OLjdHbEZiNGx4UVVLdC55b0QyMlZOa2RKZ1IuQk1KbDcxV01xeDF2bGZ4T0NPIiwiY3JlYXRlZEF0IjoiMjAyMS0wNS0yMFQwNzo0ODowNC4wMDBaIiwidXBkYXRlZEF0IjoiMjAyMS0wNS0yMFQwNzo0ODowNC4wMDBaIiwicm9sZUlkIjoidGVhY2hlciJ9fX0sImlhdCI6MTYyMTY4NzQ5NiwiZXhwIjoyMjI2NDg3NDk2fQ.RR8d4nOx1j2gXPEHhKqJVNLCxa5d6vvLCXqtQ1FHOF4"