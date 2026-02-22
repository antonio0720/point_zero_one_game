global ALERT_SOCKET
try:
ALERT_SOCKET.connect((ALERT_HOST, ALERT_PORT))
ALERT_SOCKET.sendall(b"MISCLICK")
ALERT_SOCKET.close()
except Exception as e:
print("Error sending alert:", e)

def on_key_press(event):
global last_press, first_press, misclick_window
key = event.char
if len(key) == 0 and not event.is_modifier:
last_press = time.time()
first_press = last_press
elif len(key) > 0 or event.is_modifier:
first_press = None

def check_for_misclick():
global first_press, last_press
while True:
if first_press and last_press is not None:
elapsed = time.time() - last_press
if elapsed < timedelta(seconds=2).total_seconds():
send_alert()
misclick_window.destroy()
break
time.sleep(0.1)

def main():
global last_press, first_press, misclick_window

root = tk.Tk()
root.withdraw()

last_press = None
first_press = None
misclick_window = tk.Toplevel(root)
misclick_window.title("Misclick Guard")
misclick_window.geometry("200x100+350+200")

label = tk.Label(misclick_window, text="Misclick Guard is active.\nPress Ctrl+C to exit.")
label.pack(pady=10)

root.bind("<KeyPress>", on_key_press)

threading.Thread(target=check_for_misclick).start()
root.mainloop()

if __name__ == "__main__":
main()
```
