from unidecode import unidecode
from re import match
from json import dumps

dictionary = {}

with open("mots.txt", "r") as input:
  while line := input.readline():
    word = unidecode(line.strip("\n")).lower()
    length = len(word)
    if length < 3:
      continue
    if length > 12:
      continue
    if match(".*[^a-z].*", word):
      continue
    dictionary[length] = dictionary.get(length) or {}
    dictionary[length][word] = 1

with open("mots.json", "w") as output:
  output.write(dumps(dictionary))
