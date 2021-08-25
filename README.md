# install

wget https://dev.xdevkit.jp/x/xdevkit-cli.zip -o /tmp/
unzip /tmp/xdevkit-cli.zip -d $HOME/.xdevkit
echo 'Write below lines at the end of ~/.bashrc'
echo 'export XLOGIN_INSTALL="~/.xdevkit"'
echo 'export PATH="$XLOGIN_INSTALL/bin:$PATH"'


