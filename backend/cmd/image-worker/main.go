package main

import "log"

func main() {
	log.Println("image-worker: starting (queue consumer wired in Phase 2)")
	select {}
}
