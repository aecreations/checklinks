# Makefile

EXT_VER=`./getver.py`
DIST_FILE=checklinks-$(EXT_VER).xpi
EXCLUDE = \*~ *\.py Makefile


$(DIST_FILE):
	cp -v ../LICENSE.txt .
	zip -r $(DIST_FILE) * -x $(EXCLUDE)

clean:
	rm -fv $(DIST_FILE)
	rm -fv LICENSE.txt

# End of Makefile
