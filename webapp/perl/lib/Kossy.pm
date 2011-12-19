package Kossy;

use strict;
use warnings;
use utf8;
use Carp qw//;
use Scalar::Util qw//;
use Plack::Builder;
use Router::Simple;
use Cwd qw//;
use File::Basename qw//;
use Text::Xslate;
use Try::Tiny;
use Class::Accessor::Lite (
    new => 0,
    rw => [qw/root_dir/]
);
use base qw/Exporter/;

our @EXPORT = qw/new root_dir psgi build_app _router _connect get post filter wrap_filter/;

sub new {
    my $class = shift;
    my $root_dir = shift;
    my @caller = caller;
    $root_dir ||= File::Basename::dirname( Cwd::realpath($caller[1]) );
    bless { root_dir => $root_dir }, $class;
}

sub psgi {
    my $self = shift;
    if ( ! ref $self ) {
        my $root_dir = shift;
        my @caller = caller;
        $root_dir ||= File::Basename::dirname( Cwd::realpath($caller[1]) );
        $self = $self->new($root_dir);
    }

    my $app = $self->build_app;
    $app = builder {
        enable 'ReverseProxy';
        enable 'Static',
            path => qr!^/(?:(?:css|js|images)/|favicon\.ico$)!,
            root => $self->{root_dir} . '/public';
        $app;
    };
}

sub build_app {
    my $self = shift;

    #router
    my $router = Router::Simple->new;
    $router->connect(@{$_}) for @{$self->_router};

    #xslate
    my $tx = Text::Xslate->new(
        path => [ $self->root_dir . '/views' ],
        input_layer => ':utf8',
        module => ['Text::Xslate::Bridge::TT2Like']
    );

    sub {
        my $env = shift;
        my $c = Kossy::Connection->new({
            tx => $tx,
            req => Kossy::Request->new($env),
            res => Kossy::Response->new(200),
            stash => {},
        });
        $c->res->content_type('text/html; charset=UTF-8');
        my $match = try {
            local $env->{PATH_INFO} = Encode::decode_utf8( $env->{PATH_INFO}, 1 );
            $router->match($env)
        }
        catch {
            warn $_;
            $c->halt(400,'unexpected character in request');
        };

        if ( $match ) {
            my $code = delete $match->{action};
            my $filters = delete $match->{filter};
            $c->args($match);

            my $app = sub {
                my ($self, $c) = @_;
                my $response;
                my $res = $code->($self, $c);
                Carp::croak "Undefined Response" if !$res;
                my $res_t = ref($res) || '';
                if ( Scalar::Util::blessed $res && $res->isa('Plack::Response') ) {
                    $response = $res;
                }
                elsif ( $res_t eq 'ARRAY' ) {
                    $response = Kossy::Response->new(@$res);
                }
                elsif ( !$res_t ) {
                    $c->res->body($res);
                    $response = $c->res;
                }
                else {
                    Carp::croak sprintf "Unknown Response: %s", $res_t;
                }
                $response;
            };

            for my $filter ( reverse @$filters ) {
                $app = $self->wrap_filter($filter,$app);
            }

            return try {
                $app->($self, $c)->finalize;
            } catch {
                if ( ref $_ && ref $_ eq 'Kossy::Exception' ) {
                    return $_->response;
                }
                die $_;
            };
        }
        return [404, [content_type=>'text/html'], 'Not Found'];
    };
}


my $_ROUTER={};
sub _router {
    my $klass = shift;
    my $class = ref $klass ? ref $klass : $klass;
    if ( !$_ROUTER->{$class} ) {
        $_ROUTER->{$class} = [];
    }
    if ( @_ ) {
        push @{ $_ROUTER->{$class} }, [@_];
    }
    $_ROUTER->{$class};
}

sub _connect {
    my $class = shift;
    my ( $methods, $pattern, $filter, $code ) = @_;
    if (!$code) {
        $code = $filter;
        $filter = [];
    }
    $class->_router(
        $pattern,
        { action => $code, filter => $filter },
        { method => [ map { uc $_ } @$methods ] }
    );
}

sub get {
    my $class = caller;
    $class->_connect( ['GET','HEAD'], @_  );
}

sub post {
    my $class = caller;
    $class->_connect( ['POST'], @_  );
}

my $_FILTER={};
sub filter {
    my $class = caller;
    if ( !$_FILTER->{$class} ) {
        $_FILTER->{$class} = {};
    }
    if ( @_ ) {
        $_FILTER->{$class}->{$_[0]} = $_[1];
    }
    $_FILTER->{$class};
}

sub wrap_filter {
    my $klass = shift;
    my $class = ref $klass ? ref $klass : $klass;
    if ( !$_FILTER->{$class} ) {
        $_FILTER->{$class} = {};
    }
    my ($filter,$app) = @_;
    my $filter_subref = $_FILTER->{$class}->{$filter};
    Carp::croak sprintf("Filter:%s is not exists", $filter) unless $filter_subref;
    return $filter_subref->($app);
}

package Kossy::Exception;

use strict;
use warnings;

sub new {
    my $class = shift;
    my $code = shift;
    my %args = (
        code => $code,
    );
    if ( @_ == 1 ) {
        $args{message} = shift;
    }
    elsif ( @_ % 2 == 0) {
        %args = (
            %args,
            @_
        );
    }
    bless \%args, $class;
}

sub response {
    my $self = shift;
    my $code = $self->{code} || 500;
    my $message = $self->{message};
    $message ||= HTTP::Status::status_message($code);

    my @headers = (
         'Content-Type'   => 'text/plain',
         'Content-Length' => length($message),
    );

    if ($code =~ /^3/ && (my $loc = eval { $self->{location} })) {
        push(@headers, Location => $loc);
    }

    return [ $code, \@headers, [ $message ] ];
}

package Kossy::Connection;

use strict;
use warnings;
use Class::Accessor::Lite (
    new => 1,
    rw => [qw/req res stash args tx debug/]
);

*request = \&req;
*response = \&res;

sub halt {
    my $self = shift;
    die Kossy::Exception->new(@_);
}

sub redirect {
    my $self = shift;
    $self->res->redirect(@_);
    $self->res;
}

sub render {
    my $self = shift;
    my $file = shift;
    my %args = ( @_ && ref $_[0] ) ? %{$_[0]} : @_;
    my %vars = (
        c => $self,
        stash => $self->stash,
        %args,
    );

    my $body = $self->tx->render($file, \%vars);
    $self->res->status( 200 );
    $self->res->content_type('text/html; charset=UTF-8');
    $self->res->body( $body );
    $self->res;
}

package Kossy::Request;

use strict;
use warnings;
use parent qw/Plack::Request/;
use Hash::MultiValue;
use Encode;

sub body_parameters {
    my ($self) = @_;
    $self->{'kossy.body_parameters'} ||= $self->_decode_parameters($self->SUPER::body_parameters());
}

sub query_parameters {
    my ($self) = @_;
    $self->{'kossy.query_parameters'} ||= $self->_decode_parameters($self->SUPER::query_parameters());
}

sub _decode_parameters {
    my ($self, $stuff) = @_;

    my @flatten = $stuff->flatten();
    my @decoded;
    while ( my ($k, $v) = splice @flatten, 0, 2 ) {
        push @decoded, Encode::decode_utf8($k), Encode::decode_utf8($v);
    }
    return Hash::MultiValue->new(@decoded);
}
sub parameters {
    my $self = shift;
    $self->env->{'kossy.request.merged'} ||= do {
        my $query = $self->query_parameters;
        my $body  = $self->body_parameters;
        Hash::MultiValue->new( $query->flatten, $body->flatten );
    };
}

sub body_parameters_raw {
    shift->SUPER::body_parameters();
}
sub query_parameters_raw {
    shift->SUPER::query_parameters();
}

sub parameters_raw {
    my $self = shift;
    $self->env->{'plack.request.merged'} ||= do {
        my $query = $self->SUPER::query_parameters();
        my $body  = $self->SUPER::body_parameters();
        Hash::MultiValue->new( $query->flatten, $body->flatten );
    };
}

sub param_raw {
    my $self = shift;

    return keys %{ $self->parameters_raw } if @_ == 0;

    my $key = shift;
    return $self->parameters_raw->{$key} unless wantarray;
    return $self->parameters_raw->get_all($key);
}

sub uri_for {
     my($self, $path, $args) = @_;
     my $uri = $self->base;
     $uri->path($path);
     $uri->query_form(@$args) if $args;
     $uri;
}

package Kossy::Response;

use strict;
use warnings;
use parent qw/Plack::Response/;
use Encode;

sub _body {
    my $self = shift;
    my $body = $self->body;
       $body = [] unless defined $body;
    if (!ref $body or Scalar::Util::blessed($body) && overload::Method($body, q("")) && !$body->can('getline')) {
        return [ Encode::encode_utf8($body) ];
    } else {
        return $body;
    }
}

1;



