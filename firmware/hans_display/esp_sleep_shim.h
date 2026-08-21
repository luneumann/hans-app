// The boot handler needs to know whether this wake came from the button or
// the timer, and ESPHome's generated main.cpp does not pull in the ESP-IDF
// sleep header on its own.
#pragma once
#include <esp_sleep.h>
